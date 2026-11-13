"""Feature A (Person A): neighbourhood medians from the listings table."""

import logging

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from db import get_conn
from schemas.lease import NeighbourhoodStat
from services.pricing import neighbourhood_stats

log = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/pricing", tags=["pricing"])


@router.get("/neighbourhoods", response_model=list[NeighbourhoodStat])
def list_neighbourhoods(conn=Depends(get_conn)):
    try:
        return neighbourhood_stats(conn)
    except psycopg.Error as exc:
        log.warning("neighbourhood stats failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=503, detail="Price data is unavailable right now (database error)."
        ) from exc
