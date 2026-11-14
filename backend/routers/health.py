from fastapi import APIRouter, Depends

from db import get_conn

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/db")
def health_db(conn=Depends(get_conn)):
    # Any database failure (here or in get_conn) is a 503 {"detail": ...} from main.py's
    # psycopg.Error handler, without internals in the message.
    conn.execute("select 1")
    return {"status": "ok", "db": True}
