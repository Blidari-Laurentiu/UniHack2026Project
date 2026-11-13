"""Feature A (Person A): lease check.

POST /lease/analyze redacts the lease once, then runs Gemini and the price check in parallel.
Gemini failing is not an error: the response has report=null and report_error, and the price
verdict still comes back. Pricing failing is an error (503), because the verdict is the part
that must always answer.

Storage (lease_analyses): lease_text_redacted only ever holds redacted text. result_json holds
the LeaseReport, or {"report_error": "..."} when Gemini failed, so a saved analysis reads back
exactly as it was returned.
"""

import asyncio
import logging
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from psycopg.types.json import Jsonb

from auth import current_user
from db import get_conn
from schemas.lease import (
    LeaseAnalysis,
    LeaseAnalysisDetails,
    LeaseAnalysisSummary,
    LeaseAnalyzeRequest,
    LeaseReport,
    PriceInputs,
    PriceVerdict,
)
from services.gemini import REDACTED, GeminiError, analyze_lease, redact
from services.pricing import MIN_SAMPLE, WINDOW, PricingUnavailable, price_verdict

log = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/lease", tags=["lease"])

NOT_FOUND = "analysis not found"
DB_DOWN = "Price data is unavailable right now (database error). Please try again."

COLUMNS = "id, created_at, neighbourhood, rooms, rent_eur, result_json, price_verdict"


def _pricing_error(exc: Exception) -> HTTPException:
    if isinstance(exc, PricingUnavailable):
        return HTTPException(status_code=503, detail=f"Price check is unavailable: {exc}.")
    log.warning("pricing query failed: %s", type(exc).__name__)
    return HTTPException(status_code=503, detail=DB_DOWN)


def _to_analysis(row: dict) -> LeaseAnalysis:
    result = row["result_json"] or {}
    has_report = "report_error" not in result and bool(result)
    return LeaseAnalysis(
        id=row["id"],
        created_at=row["created_at"],
        neighbourhood=row["neighbourhood"],
        rooms=row["rooms"],
        rent_eur=float(row["rent_eur"]),
        report=LeaseReport.model_validate(result) if has_report else None,
        report_error=None if has_report else result.get("report_error", "No report was saved."),
        price_verdict=PriceVerdict.model_validate(row["price_verdict"]),
    )


def _save(conn, user_id, body: LeaseAnalyzeRequest, redacted: str, result: dict, verdict: PriceVerdict):
    row = conn.execute(
        f"""
        insert into lease_analyses
            (user_id, neighbourhood, rent_eur, rooms, lease_text_redacted, result_json, price_verdict)
        values (%s, %s, %s, %s, %s, %s, %s)
        returning {COLUMNS}
        """,
        (
            user_id,
            body.neighbourhood,
            body.rent_eur,
            body.rooms,
            redacted,
            Jsonb(result),
            Jsonb(verdict.model_dump()),
        ),
    ).fetchone()
    conn.commit()
    return row


@router.post("/analyze", response_model=LeaseAnalysis)
async def analyze(body: LeaseAnalyzeRequest, user: dict = Depends(current_user), conn=Depends(get_conn)):
    redacted = redact(body.lease_text)

    # Gemini (7 to 28 s) and pricing (one query) run side by side in worker threads.
    gemini = asyncio.create_task(asyncio.to_thread(analyze_lease, redacted, body.ui_language))
    try:
        verdict = await asyncio.to_thread(
            price_verdict, conn, body.neighbourhood, body.rooms, body.rent_eur
        )
    except (PricingUnavailable, psycopg.Error) as exc:
        gemini.cancel()  # stop waiting; the thread finishes on its own and is ignored
        raise _pricing_error(exc) from exc

    try:
        result = (await gemini).model_dump()
    except GeminiError as exc:
        log.warning("lease analysis without report: %s", exc)
        result = {"report_error": str(exc)}

    try:
        row = await asyncio.to_thread(_save, conn, user["id"], body, redacted, result, verdict)
    except psycopg.Error as exc:
        log.warning("saving lease analysis failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Could not save the analysis. Please try again.") from exc
    return _to_analysis(row)


@router.get("/analyses", response_model=list[LeaseAnalysisSummary])
def list_analyses(user: dict = Depends(current_user), conn=Depends(get_conn)):
    rows = conn.execute(
        """
        select id, created_at, neighbourhood, rooms, rent_eur,
               result_json ->> 'overall_risk' as overall_risk,
               price_verdict ->> 'verdict' as verdict
        from lease_analyses
        where user_id = %s
        order by created_at desc, id
        """,
        (user["id"],),
    ).fetchall()
    return [
        LeaseAnalysisSummary(**{**row, "rent_eur": float(row["rent_eur"])})
        for row in rows
    ]


@router.get("/analyses/{analysis_id}", response_model=LeaseAnalysis)
def get_analysis(analysis_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    row = conn.execute(
        f"select {COLUMNS} from lease_analyses where id = %s and user_id = %s",
        (analysis_id, user["id"]),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return _to_analysis(row)


def _to_details(row: dict) -> LeaseAnalysisDetails:
    analysis = _to_analysis(row)  # same report / report_error rules as the result itself
    verdict = analysis.price_verdict
    # Saved text is already redacted; redacting again (a no-op then) guarantees this endpoint
    # can never hand out a CNP, IBAN or ID number, even from a row written some other way.
    text = redact(row["lease_text_redacted"] or "")
    return LeaseAnalysisDetails(
        id=analysis.id,
        created_at=analysis.created_at,
        lease_text_redacted=text,
        redaction_count=text.count(REDACTED),
        gemini_json=analysis.report.model_dump() if analysis.report else None,
        report_error=analysis.report_error,
        price_inputs=PriceInputs(
            neighbourhood=analysis.neighbourhood,
            rooms=analysis.rooms,
            rent_eur=analysis.rent_eur,
            window=WINDOW,
            min_sample=MIN_SAMPLE,
            **verdict.model_dump(),
        ),
    )


@router.get("/analyses/{analysis_id}/details", response_model=LeaseAnalysisDetails)
def get_analysis_details(analysis_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    """The redacted text sent to Gemini, Gemini's JSON and the price verdict inputs."""
    row = conn.execute(
        f"select {COLUMNS}, lease_text_redacted from lease_analyses where id = %s and user_id = %s",
        (analysis_id, user["id"]),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return _to_details(row)
