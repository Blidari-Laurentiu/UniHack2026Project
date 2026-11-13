from fastapi import APIRouter, Depends, HTTPException

from db import get_conn

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/db")
def health_db(conn=Depends(get_conn)):
    try:
        conn.execute("select 1")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database unavailable: {type(exc).__name__}")
    return {"status": "ok", "db": True}
