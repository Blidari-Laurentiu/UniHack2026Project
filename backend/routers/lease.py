from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from auth import current_user
from schemas.lease import (
    LeaseAnalysis,
    LeaseAnalysisSummary,
    LeaseAnalyzeRequest,
    LeaseReport,
    MissingClause,
    PriceVerdict,
    RiskyClause,
)

router = APIRouter(prefix="/lease", tags=["lease"])

MOCK_ANALYSIS_ID = UUID("a1111111-1111-4111-8111-111111111111")

# MOCK - replace (Gemini output from services/gemini.py)
MOCK_REPORT = LeaseReport(
    summary=(
        "Standard 12-month lease for a 2-room flat. Two clauses are unfavourable to the "
        "tenant: the deposit can be kept for any 'wear', and the landlord can raise the "
        "rent at any time. The lease does not say who pays for major repairs."
    ),
    overall_risk="medium",
    risky_clauses=[
        RiskyClause(
            quote="Garanția nu se restituie în cazul oricărei uzuri a apartamentului.",
            category="deposit",
            severity="high",
            why="Normal wear and tear is expected; this lets the landlord keep the whole deposit.",
            suggestion="Ask for: the deposit is returned within 30 days, minus documented damage beyond normal wear.",
        ),
        RiskyClause(
            quote="Proprietarul poate modifica chiria oricând, cu notificare verbală.",
            category="rent_increase",
            severity="medium",
            why="Rent can change at any moment with no written notice.",
            suggestion="Fix the rent for the contract term, or require 30 days' written notice and a cap.",
        ),
    ],
    missing_clauses=[
        MissingClause(
            name="Major repairs",
            why="Romanian Civil Code puts major repairs on the landlord; the lease should say so.",
        ),
        MissingClause(
            name="Handover report (proces-verbal de predare-primire)",
            why="Without it you cannot prove the flat's condition when you move in.",
        ),
    ],
)

# MOCK - replace (services/pricing.py)
MOCK_VERDICT = PriceVerdict(
    median_eur=450, diff_pct=11.1, verdict="above_market", scope="neighbourhood", sample_size=20
)

MOCK_ANALYSIS = LeaseAnalysis(
    id=MOCK_ANALYSIS_ID,
    created_at=datetime(2026, 11, 13, 18, 30, tzinfo=timezone.utc),
    neighbourhood="Circumvalațiunii",
    rooms=2,
    rent_eur=500,
    report=MOCK_REPORT,
    report_error=None,
    price_verdict=MOCK_VERDICT,
)


@router.post("/analyze", response_model=LeaseAnalysis)
def analyze_lease(body: LeaseAnalyzeRequest, user: dict = Depends(current_user)):
    # MOCK - replace: redact, run Gemini and pricing in parallel, save to lease_analyses
    return MOCK_ANALYSIS.model_copy(
        update={
            "neighbourhood": body.neighbourhood,
            "rooms": body.rooms,
            "rent_eur": body.rent_eur,
            "created_at": datetime.now(timezone.utc),
        }
    )


@router.get("/analyses", response_model=list[LeaseAnalysisSummary])
def list_analyses(user: dict = Depends(current_user)):
    # MOCK - replace: select the user's lease_analyses, newest first
    return [
        LeaseAnalysisSummary(
            id=MOCK_ANALYSIS.id,
            created_at=MOCK_ANALYSIS.created_at,
            neighbourhood=MOCK_ANALYSIS.neighbourhood,
            rooms=MOCK_ANALYSIS.rooms,
            rent_eur=MOCK_ANALYSIS.rent_eur,
            overall_risk=MOCK_REPORT.overall_risk,
            verdict=MOCK_VERDICT.verdict,
        )
    ]


@router.get("/analyses/{analysis_id}", response_model=LeaseAnalysis)
def get_analysis(analysis_id: UUID, user: dict = Depends(current_user)):
    # MOCK - replace: select by id and user_id
    if analysis_id != MOCK_ANALYSIS_ID:
        raise HTTPException(status_code=404, detail="analysis not found")
    return MOCK_ANALYSIS
