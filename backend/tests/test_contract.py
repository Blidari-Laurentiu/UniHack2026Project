"""Every authed endpoint refuses anonymous callers, and bad lease bodies are rejected (no DB).
The endpoints themselves are tested against the database in test_lease_api.py (Feature A)
and test_events_api.py (Feature B)."""

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

AUTHED = [
    ("post", "/lease/analyze", LEASE_BODY),
    ("get", "/lease/analyses", None),
    ("get", f"/lease/analyses/{ANALYSIS_ID}", None),
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
    app.dependency_overrides[get_conn] = lambda: None
    # No `with`: skips the lifespan, so the DB pool is never opened.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client():
    app.dependency_overrides[get_conn] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.mark.parametrize("method,path,body", AUTHED)
def test_authed_endpoints_need_auth(anon_client, method, path, body):
    r = anon_client.request(method, path, json=body)
    assert r.status_code == 401
    assert "detail" in r.json()


@pytest.mark.parametrize("rooms", [0, 4])
def test_bad_lease_body_422(client, rooms):
    # The listings cover 1 to 3 rooms, so pricing could not answer for 4 or more.
    r = client.post("/lease/analyze", json={**LEASE_BODY, "rooms": rooms})
    assert r.status_code == 422
