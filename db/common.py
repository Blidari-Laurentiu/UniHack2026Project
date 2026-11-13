"""Shared helpers for the db/ scripts. Config comes only from backend/config.py."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import psycopg  # noqa: E402

from config import settings  # noqa: E402

SCHEMA_DIR = Path(__file__).resolve().parent / "schema"


def connect() -> psycopg.Connection:
    if not settings.DATABASE_URL:
        sys.exit("DATABASE_URL is empty. Set it in backend/.env.")
    return psycopg.connect(settings.DATABASE_URL)


def require_dev(script_name: str) -> None:
    if settings.APP_ENV != "dev":
        sys.exit(f"{script_name} refuses to run: APP_ENV is '{settings.APP_ENV}', not 'dev'.")
