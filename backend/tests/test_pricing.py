"""Feature A pricing: verdict thresholds (pure) and the median queries (database).

The database tests run inside one transaction that is rolled back, so nothing is saved.
They use made-up neighbourhood names and room counts (6 and up) that the seed never uses,
so seeded listings do not change the numbers. Skipped without a dev database.
"""

import uuid
from datetime import datetime, timedelta, timezone

import psycopg
import pytest
from psycopg.rows import dict_row

from config import settings
from services.pricing import (
    PricingUnavailable,
    make_verdict,
    neighbourhood_stats,
    price_verdict,
    verdict_for,
)

# ---------- pure ----------


@pytest.mark.parametrize(
    "diff_pct,verdict",
    [
        (0, "fair"),
        (10, "fair"),
        (-10, "fair"),
        (10.01, "above_market"),
        (80, "above_market"),
        (-10.01, "below_market"),
        (-30, "below_market"),
        (-30.01, "suspiciously_low"),
        (-90, "suspiciously_low"),
    ],
)
def test_verdict_thresholds(diff_pct, verdict):
    assert verdict_for(diff_pct) == verdict


def test_make_verdict_rounds_and_keeps_scope():
    v = make_verdict(500, 472.5, "neighbourhood", 6)
    assert v.median_eur == 472.5
    assert v.diff_pct == 5.8
    assert v.verdict == "fair"
    assert v.scope == "neighbourhood"
    assert v.sample_size == 6


def test_make_verdict_uses_unrounded_diff():
    # 10.04% rounds to 10.0 for display but is still above the band.
    v = make_verdict(110.04, 100, "city", 50)
    assert v.diff_pct == 10.0
    assert v.verdict == "above_market"


def test_suspiciously_low_rent():
    assert make_verdict(200, 450, "neighbourhood", 9).verdict == "suspiciously_low"


# ---------- database ----------

needs_db = pytest.mark.skipif(
    not settings.DATABASE_URL or settings.APP_ENV != "dev",
    reason="needs DATABASE_URL and APP_ENV=dev",
)


@pytest.fixture(scope="module")
def connection():
    try:
        conn = psycopg.connect(settings.DATABASE_URL, row_factory=dict_row, connect_timeout=10)
    except psycopg.OperationalError as exc:
        pytest.skip(f"database not reachable: {type(exc).__name__}")
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


@pytest.fixture
def conn(connection):
    try:
        yield connection
    finally:
        connection.rollback()


@pytest.fixture
def tag():
    return f"Test {uuid.uuid4().hex[:8]}"


def add(conn, neighbourhood, rooms, prices, days_ago=1):
    listed_at = datetime.now(timezone.utc) - timedelta(days=days_ago)
    with conn.cursor() as cur:
        cur.executemany(
            "insert into listings (neighbourhood, rooms, price_eur, listed_at) values (%s, %s, %s, %s)",
            [(neighbourhood, rooms, p, listed_at) for p in prices],
        )


@needs_db
def test_neighbourhood_median(conn, tag):
    add(conn, tag, 6, [400, 420, 440, 460, 480])
    v = price_verdict(conn, tag, 6, 500)
    assert v.scope == "neighbourhood"
    assert v.sample_size == 5
    assert v.median_eur == 440
    assert v.diff_pct == 13.6
    assert v.verdict == "above_market"


@needs_db
def test_neighbourhood_match_ignores_case(conn, tag):
    add(conn, tag, 6, [400, 410, 420, 430, 440])
    assert price_verdict(conn, tag.upper(), 6, 420).scope == "neighbourhood"


@needs_db
def test_city_fallback_under_five_listings(conn, tag):
    add(conn, f"{tag} A", 7, [300, 310, 320, 330])  # only 4 here
    add(conn, f"{tag} B", 7, [500, 600, 700])
    v = price_verdict(conn, f"{tag} A", 7, 450)
    assert v.scope == "city"
    assert v.sample_size == 7
    assert v.median_eur == 330


@needs_db
def test_unknown_neighbourhood_uses_city(conn, tag):
    add(conn, tag, 8, [400, 500, 600])
    v = price_verdict(conn, "Nowhere", 8, 500)
    assert (v.scope, v.median_eur, v.verdict) == ("city", 500, "fair")


@needs_db
def test_old_listings_are_ignored(conn, tag):
    add(conn, tag, 9, [100] * 5, days_ago=400)
    add(conn, tag, 9, [500] * 5)
    v = price_verdict(conn, tag, 9, 500)
    assert (v.sample_size, v.median_eur) == (5, 500)


@needs_db
def test_no_listings_raises(conn):
    with pytest.raises(PricingUnavailable):
        price_verdict(conn, "Centru", 99, 500)


@needs_db
def test_neighbourhood_stats(conn, tag):
    add(conn, tag, 6, [300, 320, 340])
    add(conn, tag, 7, [500, 600])
    stat = next(s for s in neighbourhood_stats(conn) if s.name == tag)
    assert stat.median_eur_by_rooms == {6: 320, 7: 550}
    assert stat.sample_size == 5
