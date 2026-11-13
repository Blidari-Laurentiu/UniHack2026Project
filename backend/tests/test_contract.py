"""Feature A endpoints answer and match their response models (mocks, no DB), and every
authed endpoint refuses anonymous callers. Feature B has real endpoints: see test_events_api.py."""

import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from auth import current_user  # noqa: E402
from db import get_conn  # noqa: E402
from main import app  # noqa: E402

FAKE_USER = {
    "id": UUID("c1000000-0000-4000-8000-000000000001"),
    "auth0_sub": "dev|mei",
    "display_name": "Mei",
    "email": None,
    "is_student": True,
    "created_at": datetime(2026, 11, 13, tzinfo=timezone.utc),
}
EVENT_ID = "e1000000-0000-4000-8000-000000000001"
ANALYSIS_ID = "a1111111-1111-4111-8111-111111111111"
LEASE_BODY = {
    "lease_text": "CONTRACT DE ÎNCHIRIERE. Proprietarul închiriază chiriașului apartamentul ... " * 2,
    "neighbourhood": "Circumvalațiunii",
    "rooms": 2,
    "rent_eur": 500,
}
PROFILE_BODY = {
    "display_name": "Mei",
    "interest_slugs": ["board_games", "theatre"],
    "availability": ["weekday_evening"],
}

MOCKED = [
    ("post", "/lease/analyze", LEASE_BODY),
    ("get", "/lease/analyses", None),
    ("get", f"/lease/analyses/{ANALYSIS_ID}", None),
    ("get", "/pricing/neighbourhoods", None),
]
AUTHED = MOCKED[:3] + [
    ("post", f"/events/{EVENT_ID}/join", None),
    ("post", f"/events/{EVENT_ID}/leave", None),
    ("post", f"/events/{EVENT_ID}/match", None),
    ("get", f"/events/{EVENT_ID}/my-group", None),
    ("get", "/profile", None),
    ("put", "/profile", PROFILE_BODY),
]


@pytest.fixture
def client():
    app.dependency_overrides[current_user] = lambda: FAKE_USER
    # No `with`: skips the lifespan, so the DB pool is never opened.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client():
    app.dependency_overrides[get_conn] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.mark.parametrize("method,path,body", MOCKED)
def test_endpoint_ok(client, method, path, body):
    r = client.request(method, path, json=body)
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("method,path,body", AUTHED)
def test_authed_endpoints_need_auth(anon_client, method, path, body):
    r = anon_client.request(method, path, json=body)
    assert r.status_code == 401
    assert "detail" in r.json()


def test_analyze_shape(client):
    data = client.post("/lease/analyze", json=LEASE_BODY).json()
    assert data["rent_eur"] == 500
    assert data["report"]["overall_risk"] in {"low", "medium", "high"}
    assert {"quote", "category", "severity", "why", "suggestion"} <= data["report"]["risky_clauses"][0].keys()
    assert {"median_eur", "diff_pct", "verdict", "scope", "sample_size"} <= data["price_verdict"].keys()


def test_unknown_ids_404(client):
    missing = "00000000-0000-4000-8000-000000000000"
    assert client.get(f"/lease/analyses/{missing}").json() == {"detail": "analysis not found"}


def test_bad_lease_body_422(client):
    r = client.post("/lease/analyze", json={**LEASE_BODY, "rooms": 0})
    assert r.status_code == 422
