"""Auth tests. The database is replaced by a fake upsert, so no DB is needed."""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import auth
from config import settings
from db import get_conn
from main import app


@pytest.fixture
def client(monkeypatch):
    calls = []

    def fake_upsert(conn, auth0_sub, email, is_student, display_name):
        calls.append(auth0_sub)
        return {
            "id": str(uuid.uuid4()),
            "auth0_sub": auth0_sub,
            "display_name": display_name,
            "email": email,
            "is_student": is_student,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    monkeypatch.setattr(auth, "upsert_user", fake_upsert)
    app.dependency_overrides[get_conn] = lambda: None
    # No `with`: skips the lifespan, so the DB pool is never opened (it cannot
    # be reopened once closed, which would break later tests).
    c = TestClient(app)
    c.upsert_calls = calls
    yield c
    app.dependency_overrides.clear()


def test_no_token_gives_401(client):
    r = client.get("/me")
    assert r.status_code == 401
    assert "detail" in r.json()
    assert client.upsert_calls == []


def test_garbage_token_gives_401(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH0_DOMAIN", "example.auth0.com")
    monkeypatch.setattr(settings, "AUTH0_AUDIENCE", "https://api.example")
    r = client.get("/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401
    assert r.json() == {"detail": "invalid token"}


def test_dev_header_works_in_dev(client, monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "dev")
    r = client.get("/me", headers={"X-Dev-User": "alice"})
    assert r.status_code == 200
    body = r.json()
    assert body["auth0_sub"] == "dev|alice"
    assert body["display_name"] == "alice"
    assert client.upsert_calls == ["dev|alice"]


def test_dev_header_refused_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    r = client.get("/me", headers={"X-Dev-User": "alice"})
    assert r.status_code == 401
    assert "detail" in r.json()
    assert client.upsert_calls == []
