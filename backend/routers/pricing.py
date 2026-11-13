"""Feature A (Person A): neighbourhood medians and the monthly price trend from listings."""

import logging

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, Response

from db import get_conn
from schemas.lease import MAX_ROOMS, NeighbourhoodStat, TrendPoint
from services.pricing import neighbourhood_stats, price_trend

log = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/pricing", tags=["pricing"])

DB_DOWN = "Price data is unavailable right now (database error)."
BAD_ROOMS = f"rooms must be a whole number from 1 to {MAX_ROOMS}."


@router.get("/neighbourhoods", response_model=list[NeighbourhoodStat])
def list_neighbourhoods(conn=Depends(get_conn)):
    try:
        return neighbourhood_stats(conn)
    except psycopg.Error as exc:
        log.warning("neighbourhood stats failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail=DB_DOWN) from exc


def parse_rooms(rooms: str | None) -> int:
    """rooms is read as text so a bad value gets a plain {"detail": "..."} 422, not a list."""
    try:
        n = int((rooms or "").strip())
    except ValueError:
        n = 0
    if not 1 <= n <= MAX_ROOMS:
        raise HTTPException(status_code=422, detail=BAD_ROOMS)
    return n


@router.get("/trend", response_model=list[TrendPoint])
def get_trend(
    response: Response,
    rooms: str | None = Query(None, description=f"Required, 1 to {MAX_ROOMS}."),
    neighbourhood: str | None = Query(None, description="Optional; leave out or blank for city-wide."),
    conn=Depends(get_conn),
):
    """Monthly median asking rent for the last 12 months, oldest first."""
    n = parse_rooms(rooms)
    if neighbourhood and len(neighbourhood) > 80:
        raise HTTPException(status_code=422, detail="neighbourhood is too long (80 characters at most).")
    try:
        points, source = price_trend(conn, n, neighbourhood)
    except psycopg.Error as exc:
        log.warning("price trend failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail=DB_DOWN) from exc
    # Which path answered: continuous_aggregate (TimescaleDB) or listings (plain Postgres).
    response.headers["X-Trend-Source"] = source
    return points
