from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import settings

pool = ConnectionPool(
    conninfo=settings.DATABASE_URL,
    min_size=1,
    max_size=5,
    kwargs={"row_factory": dict_row},
    open=False,
)


def get_conn():
    """FastAPI dependency: yields a pooled connection, commits on success."""
    with pool.connection() as conn:
        yield conn


def get_connector():
    """FastAPI dependency for endpoints that wait on something slow (Gemini).

    Returns pool.connection itself, so the endpoint opens short connections
    (`with connect() as conn:`, committed on exit) instead of holding one for the whole
    request. Tests override it to hand out their own connection.
    """
    return pool.connection
