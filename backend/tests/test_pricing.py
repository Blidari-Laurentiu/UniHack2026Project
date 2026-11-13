"""Feature A pricing: verdict thresholds (pure) and the median queries (database).

The database tests run inside one transaction that is rolled back, so nothing is saved.
They use made-up neighbourhood names and room counts (6 and up) that the seed never uses,
so seeded listings do not change the numbers. Skipped without a dev database.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import psycopg
import pytest
from psycopg.rows import dict_row

import services.pricing as pricing
from config import settings
from services.pricing import (
    PricingUnavailable,
    make_verdict,
    neighbourhood_stats,
    price_trend,
    price_verdict,
    to_points,
    trend_sql,
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


@pytest.mark.parametrize(
    "city,aggregate,reads,filters_hood",
    [
        (False, True, "from listings_monthly\n", True),
        (True, True, "from listings_monthly_city", False),
        (False, False, "from listings\n", True),
        (True, False, "from listings\n", False),
    ],
)
def test_trend_sql_picks_the_source(city, aggregate, reads, filters_hood):
    sql = trend_sql(city, aggregate)
    assert reads in sql
    assert ("%(neighbourhood)s" in sql) is filters_hood
    assert "rooms = %(rooms)s" in sql
    assert "interval '11 months'" in sql  # 12 months including the current one
    assert ("date_trunc('month', listed_at" in sql) is not aggregate


def test_to_points_sorts_rounds_and_drops_empty_months():
    rows = [
        {"month": date(2026, 3, 1), "median_eur": 455.125, "n": 4},
        {"month": date(2026, 1, 1), "median_eur": Decimal("430"), "n": 6},
        {"month": date(2026, 2, 1), "median_eur": 440.0, "n": 0},
    ]
    points = to_points(rows)
    assert [(p.month, p.median_eur, p.count) for p in points] == [
        (date(2026, 1, 1), 430.0, 6),
        (date(2026, 3, 1), 455.12, 4),
    ]
    assert points[0].model_dump(mode="json") == {"month": "2026-01-01", "median_eur": 430.0, "count": 6}


def test_to_points_empty():
    assert to_points([]) == []


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


# --- price trend ---


def this_month():
    return datetime.now(timezone.utc).date().replace(day=1)


@needs_db
def test_trend_from_the_continuous_aggregate_includes_new_listings(conn, tag):
    """New, uncommitted listings show up through real-time aggregation of the current month."""
    if not pricing.has_trend_aggregate(conn):
        pytest.skip("continuous aggregates not created (no TimescaleDB or schema not applied)")
    add(conn, tag, 6, [400, 420, 460], days_ago=0)
    points, source = price_trend(conn, 6, tag.lower())  # neighbourhood match ignores case
    assert source == "continuous_aggregate"
    assert [(p.month, p.median_eur, p.count) for p in points] == [(this_month(), 420, 3)]

    city, _ = price_trend(conn, 6)
    assert city[-1].month == this_month()
    assert city[-1].count >= 3


@needs_db
def test_trend_from_listings_without_timescale(conn, tag, monkeypatch):
    monkeypatch.setattr(pricing, "has_trend_aggregate", lambda conn: False)
    add(conn, tag, 6, [400, 420, 460], days_ago=0)
    add(conn, tag, 6, [300, 310], days_ago=45)
    add(conn, tag, 6, [100] * 5, days_ago=400)  # older than 12 months: left out
    points, source = price_trend(conn, 6, tag)
    assert source == "listings"
    assert [(p.median_eur, p.count) for p in points] == [(305, 2), (420, 3)]
    assert points[0].month < points[1].month == this_month()


@needs_db
@pytest.mark.parametrize("aggregate", [True, False])
def test_trend_unknown_neighbourhood_is_empty(conn, monkeypatch, aggregate):
    if aggregate and not pricing.has_trend_aggregate(conn):
        pytest.skip("continuous aggregates not created")
    monkeypatch.setattr(pricing, "has_trend_aggregate", lambda conn: aggregate)
    assert price_trend(conn, 2, "Nowhere at all")[0] == []
