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

    def fake_upsert(conn, auth0_sub, email, display_name):
        calls.append(auth0_sub)
        return {
            "id": str(uuid.uuid4()),
            "auth0_sub": auth0_sub,
            "display_name": display_name,
            "email": email,
            "is_student": False,
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


def test_app_env_defaults_to_production(monkeypatch):
    """Without APP_ENV set anywhere, the dev bypass must be off (fail closed)."""
    from config import Settings

    monkeypatch.delenv("APP_ENV", raising=False)
    assert Settings(_env_file=None).APP_ENV == "production"


def test_dev_header_refused_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    r = client.get("/me", headers={"X-Dev-User": "alice"})
    assert r.status_code == 401
    assert "detail" in r.json()
    assert client.upsert_calls == []


# --- Real signed tokens: login methods, roles and admin MFA -------------------------------
# Tokens are RS256 JWTs signed with a key made here; the JWKS lookup is replaced by that
# key's public half, so verify_token runs for real (signature, audience, issuer, expiry).

DOMAIN = "tenant.example.auth0.com"
AUDIENCE = "https://newcomer-hub/api"


class FakeConn:
    """Stands in for a pooled connection: every query returns no rows."""

    def execute(self, *args, **kwargs):
        return self

    def fetchall(self):
        return []


@pytest.fixture(scope="module")
def rsa_key():
    from cryptography.hazmat.primitives.asymmetric import rsa

    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def make_token(client, monkeypatch, rsa_key):
    """Returns make(sub, **claims) -> Authorization headers for a token Auth0 could have issued."""
    import time
    from types import SimpleNamespace

    import jwt

    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "AUTH0_DOMAIN", DOMAIN)
    monkeypatch.setattr(settings, "AUTH0_AUDIENCE", AUDIENCE)
    jwks = SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=rsa_key.public_key())
    )
    monkeypatch.setattr(auth, "_jwks_client", lambda domain: jwks)
    app.dependency_overrides[get_conn] = lambda: FakeConn()

    def make(sub, key=rsa_key, **claims):
        payload = {
            "iss": f"https://{DOMAIN}/",
            "aud": AUDIENCE,
            "sub": sub,
            "exp": int(time.time()) + 300,
            auth.EMAIL_VERIFIED_CLAIM: True,
            **claims,
        }
        return {"Authorization": "Bearer " + jwt.encode(payload, key, algorithm="RS256")}

    return make


@pytest.mark.parametrize(
    "sub,email",
    [
        ("google-oauth2|108204268033311374519", "ana@gmail.com"),  # social: Google
        ("email|65f1c0ffee0ddba11c0de123", "ana@student.upt.ro"),  # passwordless email code
        ("auth0|65f1c0ffee0ddba11c0de456", "ana@example.com"),  # database (password)
    ],
)
def test_every_login_method_is_accepted(client, make_token, sub, email):
    claims = {auth.EMAIL_CLAIM: email} if email else {}
    r = client.get("/me", headers=make_token(sub, **claims))
    assert r.status_code == 200
    body = r.json()
    assert body["auth0_sub"] == sub
    assert body["email"] == email
    assert body["roles"] == []
    assert body["mfa"] is False
    assert client.upsert_calls == [sub]


def test_student_claim_is_ignored(client, make_token):
    """Student status comes only from the university code flow, never from the token."""
    r = client.get("/me", headers=make_token("email|abc", **{"https://newcomer-hub/student": True}))
    assert r.json()["is_student"] is False


@pytest.mark.parametrize(
    "bad",
    [{"aud": "https://someone-else/api"}, {"iss": "https://evil.example/"}, {"exp": 1}],
)
def test_wrong_audience_issuer_or_expired_gives_401(client, make_token, bad):
    r = client.get("/me", headers=make_token("google-oauth2|1", **bad))
    assert r.status_code == 401
    assert client.upsert_calls == []


def test_token_signed_by_another_key_gives_401(client, make_token):
    from cryptography.hazmat.primitives.asymmetric import rsa

    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    r = client.get("/me", headers=make_token("google-oauth2|1", key=other))
    assert r.status_code == 401
    assert r.json() == {"detail": "invalid token"}


def test_me_shows_roles_and_mfa(client, make_token):
    headers = make_token(
        "google-oauth2|1", **{auth.ROLES_CLAIM: ["moderator", "admin"], auth.MFA_CLAIM: True}
    )
    body = client.get("/me", headers=headers).json()
    assert body["roles"] == ["admin", "moderator"]
    assert body["mfa"] is True


@pytest.mark.parametrize("roles", ["admin", {"admin": True}, None, [1, None]])
def test_malformed_roles_claim_grants_nothing(client, make_token, roles):
    headers = make_token("google-oauth2|1", **{auth.ROLES_CLAIM: roles, auth.MFA_CLAIM: True})
    assert client.get("/me", headers=headers).json()["roles"] == []
    assert client.get("/admin/users", headers=headers).status_code == 403


@pytest.mark.parametrize("path", ["/admin/users", "/admin/reports"])
def test_admin_endpoints_need_a_token(client, make_token, path):
    r = client.get(path)
    assert r.status_code == 401
    assert "detail" in r.json()


@pytest.mark.parametrize("path", ["/admin/users", "/admin/reports"])
def test_user_without_a_role_gets_403(client, make_token, path):
    r = client.get(path, headers=make_token("email|abc"))
    assert r.status_code == 403
    assert r.json() == {"detail": "you do not have permission to do this"}


def test_moderator_sees_reports_but_not_users(client, make_token):
    headers = make_token("google-oauth2|2", **{auth.ROLES_CLAIM: ["moderator"]})
    assert client.get("/admin/reports", headers=headers).status_code == 200
    assert client.get("/admin/users", headers=headers).status_code == 403


@pytest.mark.parametrize("path", ["/admin/users", "/admin/reports"])
def test_admin_with_mfa_is_allowed(client, make_token, path):
    headers = make_token("google-oauth2|3", **{auth.ROLES_CLAIM: ["admin"], auth.MFA_CLAIM: True})
    r = client.get(path, headers=headers)
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.parametrize("path", ["/admin/users", "/admin/reports"])
@pytest.mark.parametrize("mfa", [None, False, "true", 1])
@pytest.mark.parametrize("roles", [["admin"], ["admin", "moderator"]])
def test_admin_without_mfa_is_refused(client, make_token, path, mfa, roles):
    claims = {auth.ROLES_CLAIM: roles}
    if mfa is not None:
        claims[auth.MFA_CLAIM] = mfa
    r = client.get(path, headers=make_token("google-oauth2|3", **claims))
    assert r.status_code == 403
    assert r.json() == {"detail": "admin accounts must sign in with multi-factor authentication"}


def test_moderator_does_not_need_mfa(client, make_token):
    headers = make_token("email|mod", **{auth.ROLES_CLAIM: ["moderator"]})
    assert client.get("/admin/reports", headers=headers).status_code == 200


def test_dev_roles_header_works_in_dev(client, monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "dev")
    app.dependency_overrides[get_conn] = lambda: FakeConn()
    plain = {"X-Dev-User": "alice"}
    admin = {"X-Dev-User": "alice", "X-Dev-Roles": "admin, moderator"}
    assert client.get("/admin/users", headers=plain).status_code == 403
    assert client.get("/admin/users", headers=admin).status_code == 200
    assert client.get("/me", headers=admin).json()["roles"] == ["admin", "moderator"]


def test_dev_roles_header_ignored_in_production(client, make_token):
    headers = {**make_token("email|abc"), "X-Dev-Roles": "admin"}
    assert client.get("/admin/users", headers=headers).status_code == 403
    r = client.get("/admin/users", headers={"X-Dev-User": "alice", "X-Dev-Roles": "admin"})
    assert r.status_code == 401


# --- Email verification -------------------------------------------------------------------

UNVERIFIED = [{auth.EMAIL_VERIFIED_CLAIM: False}, {auth.EMAIL_VERIFIED_CLAIM: None},
              {auth.EMAIL_VERIFIED_CLAIM: "true"}, {auth.EMAIL_VERIFIED_CLAIM: 1}]


@pytest.mark.parametrize("claims", UNVERIFIED)
@pytest.mark.parametrize("path", ["/me", "/profile", "/lease/analyses", "/admin/users"])
def test_unverified_email_gives_403_everywhere(client, make_token, claims, path):
    headers = make_token(
        "auth0|new", **{auth.EMAIL_CLAIM: "new@example.com", auth.ROLES_CLAIM: ["admin"],
                        auth.MFA_CLAIM: True}, **claims
    )
    r = client.get(path, headers=headers)
    assert r.status_code == 403
    assert r.json() == {"detail": auth.EMAIL_NOT_VERIFIED}
    assert client.upsert_calls == []  # no users row for an unverified account


def test_token_without_the_verified_claim_is_refused(client, make_token, rsa_key):
    """Old tokens, or an Action that does not set the claim: fail closed."""
    import time

    import jwt

    payload = {"iss": f"https://{DOMAIN}/", "aud": AUDIENCE, "sub": "google-oauth2|1",
               "exp": int(time.time()) + 300}
    token = jwt.encode(payload, rsa_key, algorithm="RS256")
    r = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert r.json() == {"detail": auth.EMAIL_NOT_VERIFIED}


def test_github_without_an_email_is_not_verified(client, make_token):
    r = client.get("/me", headers=make_token("github|1234567", **{auth.EMAIL_VERIFIED_CLAIM: False}))
    assert r.status_code == 403


def test_unverified_user_still_sees_the_public_event_list(client, make_token):
    """GET /events takes an optional user: unverified browses it like an anonymous caller."""
    headers = make_token("auth0|new", **{auth.EMAIL_VERIFIED_CLAIM: False})
    r = client.get("/events", headers=headers)
    assert r.status_code == 200
    assert client.upsert_calls == []


def test_unverified_user_cannot_join_an_event(client, make_token):
    headers = make_token("auth0|new", **{auth.EMAIL_VERIFIED_CLAIM: False})
    r = client.post(f"/events/{uuid.uuid4()}/join", headers=headers)
    assert r.status_code == 403
    assert r.json() == {"detail": auth.EMAIL_NOT_VERIFIED}


def test_dev_user_counts_as_verified(client, monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "dev")
    assert client.get("/me", headers={"X-Dev-User": "alice"}).status_code == 200
