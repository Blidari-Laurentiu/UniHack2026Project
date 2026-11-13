"""Feature A endpoints (lease and pricing) against the real schema.

Gemini is never called: analyze_lease is replaced in every test. Each test runs inside one
database transaction that is rolled back, so nothing is saved. Users come from the X-Dev-User
header (APP_ENV=dev), through the real current_user. Listings use a made-up neighbourhood, so
the seeded listings do not change the numbers. Skipped without a dev database.
"""

import uuid
from datetime import datetime, timedelta, timezone

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

import routers.lease as lease_router
import routers.pricing as pricing_router
import services.pricing as pricing_service
from config import settings
from db import get_conn
from main import app
from schemas.lease import LeaseReport, MissingClause, RiskyClause
from services.gemini import GeminiError
from services.pricing import PricingUnavailable

pytestmark = pytest.mark.skipif(
    not settings.DATABASE_URL or settings.APP_ENV != "dev",
    reason="needs DATABASE_URL and APP_ENV=dev",
)

MISSING = "00000000-0000-4000-8000-000000000000"
CNP = "1960523350011"
IBAN = "RO49 AAAA 1B31 0075 9384 0000"
ID_CARD = "seria TM nr. 123456"
LEASE = (
    "CONTRACT DE ÎNCHIRIERE. Proprietar: Ion Popescu, CNP "
    f"{CNP}, act de identitate {ID_CARD}. Chiria se plătește în contul {IBAN}. "
    "Garanția nu se restituie în cazul oricărei uzuri a apartamentului."
)
REPORT = LeaseReport(
    summary="Short lease with one unfair deposit clause.",
    overall_risk="medium",
    risky_clauses=[
        RiskyClause(
            quote="Garanția nu se restituie în cazul oricărei uzuri a apartamentului.",
            category="deposit",
            severity="high",
            why="Normal wear is expected.",
            suggestion="Ask for the deposit back within 30 days.",
        )
    ],
    missing_clauses=[MissingClause(name="Major repairs", why="The lease does not say.")],
)


@pytest.fixture(scope="module")
def connection():
    try:
        conn = psycopg.connect(settings.DATABASE_URL, row_factory=dict_row, connect_timeout=10)
    except psycopg.OperationalError as exc:
        pytest.skip(f"database not reachable: {type(exc).__name__}")
    conn.commit = lambda: None  # the endpoints commit; tests must never save anything
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
def hood(conn):
    """A made-up neighbourhood with five 2-room listings, median 450."""
    name = f"Test {uuid.uuid4().hex[:8]}"
    listed_at = datetime.now(timezone.utc) - timedelta(days=1)
    with conn.cursor() as cur:
        cur.executemany(
            "insert into listings (neighbourhood, rooms, price_eur, listed_at) values (%s, 2, %s, %s)",
            [(name, p, listed_at) for p in (400, 425, 450, 475, 500)],
        )
    return name


@pytest.fixture
def gemini(monkeypatch):
    """Replaces analyze_lease; records what it was sent. Set .error to make it fail."""

    class FakeGemini:
        calls: list[tuple[str, str]] = []
        error: Exception | None = None

        def __call__(self, text, ui_language="en"):
            self.calls.append((text, ui_language))
            if self.error:
                raise self.error
            return REPORT.model_copy(deep=True)

    fake = FakeGemini()
    fake.calls = []
    monkeypatch.setattr(lease_router, "analyze_lease", fake)
    return fake


@pytest.fixture
def client(conn, gemini):
    app.dependency_overrides[get_conn] = lambda: conn
    # No `with`: skips the lifespan, so the DB pool is never opened.
    yield TestClient(app)
    app.dependency_overrides.clear()


def as_user(name):
    return {"X-Dev-User": f"test-{name}-{uuid.uuid4().hex[:6]}"}


def body(hood, **extra):
    return {"lease_text": LEASE, "neighbourhood": hood, "rooms": 2, "rent_eur": 500, **extra}


def saved_row(conn, analysis_id):
    return conn.execute("select * from lease_analyses where id = %s", (analysis_id,)).fetchone()


# --- analyze ---


def test_analyze_happy_path(client, conn, gemini, hood):
    me = as_user("mei")
    r = client.post("/lease/analyze", json=body(hood, ui_language="ro"), headers=me)
    assert r.status_code == 200, r.text
    data = r.json()

    assert (data["neighbourhood"], data["rooms"], data["rent_eur"]) == (hood, 2, 500.0)
    assert data["report"] == REPORT.model_dump()
    assert data["report_error"] is None
    assert data["price_verdict"] == {
        "median_eur": 450.0,
        "diff_pct": 11.1,
        "verdict": "above_market",
        "scope": "neighbourhood",
        "sample_size": 5,
    }
    assert gemini.calls[0][1] == "ro"

    # Saved, and reads back exactly as returned.
    assert client.get(f"/lease/analyses/{data['id']}", headers=me).json() == data
    assert client.get("/lease/analyses", headers=me).json() == [
        {
            "id": data["id"],
            "created_at": data["created_at"],
            "neighbourhood": hood,
            "rooms": 2,
            "rent_eur": 500.0,
            "overall_risk": "medium",
            "verdict": "above_market",
        }
    ]


def test_gemini_failure_still_returns_price(client, conn, gemini, hood):
    gemini.error = GeminiError("Gemini request failed: TimeoutError")
    me = as_user("mei")
    r = client.post("/lease/analyze", json=body(hood), headers=me)
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["report"] is None
    assert data["report_error"] == "Gemini request failed: TimeoutError"
    assert data["price_verdict"]["verdict"] == "above_market"

    assert saved_row(conn, data["id"])["result_json"] == {
        "report_error": "Gemini request failed: TimeoutError"
    }
    assert client.get(f"/lease/analyses/{data['id']}", headers=me).json() == data
    assert client.get("/lease/analyses", headers=me).json()[0]["overall_risk"] is None


def test_personal_ids_never_reach_gemini_or_the_database(client, conn, gemini, hood):
    data = client.post("/lease/analyze", json=body(hood), headers=as_user("mei")).json()

    sent = gemini.calls[0][0]
    stored = saved_row(conn, data["id"])["lease_text_redacted"]
    for text in (sent, stored):
        assert "[REDACTED]" in text
        for secret in (CNP, IBAN, "TM nr. 123456", "123456"):
            assert secret not in text
        assert "Garanția nu se restituie" in text  # the lease itself is kept


@pytest.mark.parametrize(
    "error,detail",
    [
        (PricingUnavailable("no listings with 2 rooms to compare with"),
         "Price check is unavailable: no listings with 2 rooms to compare with."),
        (psycopg.OperationalError("server closed the connection"),
         lease_router.DB_DOWN),
    ],
)
def test_pricing_failure_is_a_503_and_saves_nothing(client, conn, monkeypatch, hood, error, detail):
    def broken(*args, **kwargs):
        raise error

    monkeypatch.setattr(lease_router, "price_verdict", broken)
    me = as_user("mei")
    r = client.post("/lease/analyze", json=body(hood), headers=me)
    assert (r.status_code, r.json()) == (503, {"detail": detail})
    assert client.get("/lease/analyses", headers=me).json() == []


def test_unknown_neighbourhood_falls_back_to_city(client, hood):
    r = client.post("/lease/analyze", json=body("Nowhere at all"), headers=as_user("mei"))
    assert r.status_code == 200, r.text
    assert r.json()["price_verdict"]["scope"] == "city"


# --- reading analyses ---


def test_list_is_newest_first_and_only_mine(client, conn, hood):
    me, other = as_user("mei"), as_user("andrei")
    first = client.post("/lease/analyze", json=body(hood, rent_eur=400), headers=me).json()
    second = client.post("/lease/analyze", json=body(hood, rent_eur=600), headers=me).json()
    client.post("/lease/analyze", json=body(hood), headers=other)

    # One transaction means one now(): set distinct times to test the order.
    conn.execute(
        "update lease_analyses set created_at = created_at - interval '1 hour' where id = %s",
        (first["id"],),
    )
    listed = client.get("/lease/analyses", headers=me).json()
    assert [a["id"] for a in listed] == [second["id"], first["id"]]


def test_another_users_analysis_is_404(client, hood):
    mine = client.post("/lease/analyze", json=body(hood), headers=as_user("mei")).json()
    for path in (f"/lease/analyses/{mine['id']}", f"/lease/analyses/{MISSING}"):
        r = client.get(path, headers=as_user("andrei"))
        assert (r.status_code, r.json()) == (404, {"detail": "analysis not found"})


def test_new_user_has_no_analyses(client):
    assert client.get("/lease/analyses", headers=as_user("new")).json() == []


# --- pricing ---


def test_neighbourhoods_from_listings(client, hood):
    r = client.get("/pricing/neighbourhoods")
    assert r.status_code == 200, r.text
    stat = next(s for s in r.json() if s["name"] == hood)
    assert stat == {"name": hood, "median_eur_by_rooms": {"2": 450.0}, "sample_size": 5}


# --- price trend ---


@pytest.mark.parametrize("use_aggregate", [True, False])
def test_trend_for_a_neighbourhood(client, conn, monkeypatch, use_aggregate):
    # Listed now: with TimescaleDB the current month is real-time, so the aggregate sees these
    # uncommitted rows (an older month would be materialized and need a refresh).
    if use_aggregate and not pricing_service.has_trend_aggregate(conn):
        pytest.skip("continuous aggregates not created")
    monkeypatch.setattr(pricing_service, "has_trend_aggregate", lambda conn: use_aggregate)
    name = f"Test {uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    with conn.cursor() as cur:
        cur.executemany(
            "insert into listings (neighbourhood, rooms, price_eur, listed_at) values (%s, %s, %s, %s)",
            [(name, 2, p, now) for p in (300, 500, 700)] + [(name, 3, 900, now)],
        )
    r = client.get("/pricing/trend", params={"neighbourhood": name, "rooms": 2})
    assert r.status_code == 200, r.text
    assert r.headers["X-Trend-Source"] == ("continuous_aggregate" if use_aggregate else "listings")
    assert r.json() == [{"month": now.date().replace(day=1).isoformat(), "median_eur": 500.0, "count": 3}]


def test_trend_city_wide_is_oldest_first_and_at_most_12_months(client):
    for params in ({"rooms": 2}, {"rooms": 2, "neighbourhood": ""}, {"rooms": "2", "neighbourhood": "  "}):
        r = client.get("/pricing/trend", params=params)
        assert r.status_code == 200, r.text
        months = [p["month"] for p in r.json()]
        assert months == sorted(set(months))
        assert len(months) <= 12


def test_trend_unknown_neighbourhood_is_empty(client):
    r = client.get("/pricing/trend", params={"neighbourhood": "Nowhere at all", "rooms": 1})
    assert (r.status_code, r.json()) == (200, [])


@pytest.mark.parametrize("rooms", [None, "", "0", "4", "two", "2.5", "-1"])
def test_trend_bad_rooms_is_422(client, rooms):
    params = {"neighbourhood": "Centru"} | ({} if rooms is None else {"rooms": rooms})
    r = client.get("/pricing/trend", params=params)
    assert (r.status_code, r.json()) == (422, {"detail": pricing_router.BAD_ROOMS})


def test_trend_neighbourhood_too_long_is_422(client):
    r = client.get("/pricing/trend", params={"neighbourhood": "x" * 81, "rooms": 2})
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)


def test_trend_database_error_is_503(client, monkeypatch):
    def broken(*args, **kwargs):
        raise psycopg.OperationalError("server closed the connection")

    monkeypatch.setattr(pricing_router, "price_trend", broken)
    r = client.get("/pricing/trend", params={"rooms": 2})
    assert (r.status_code, r.json()) == (503, {"detail": pricing_router.DB_DOWN})
