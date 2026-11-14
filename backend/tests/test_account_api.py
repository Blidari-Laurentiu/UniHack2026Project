"""Account settings: password reset, 2FA status and removal, account deletion.

Auth0 is replaced by fakes. The deletion tests use the real schema inside a transaction
that is rolled back; they are skipped without DATABASE_URL and APP_ENV=dev.
"""

import uuid
from datetime import datetime, timezone

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from auth import authenticate, caller_access
from config import settings
from db import get_conn
from main import app
from routers import account
from services import auth0_api
from services.auth0_api import Auth0Error


class FakeAuth0:
    """Stands in for services.auth0_api. Records what the router asked for."""

    def __init__(self):
        self.is_configured = True
        self.totp = False
        self.error = None
        self.calls = []

    def _call(self, name, arg):
        self.calls.append((name, arg))
        if self.error:
            raise self.error

    def configured(self):
        return self.is_configured

    def has_totp(self, sub):
        self._call("has_totp", sub)
        return self.totp

    def remove_totp(self, sub):
        self._call("remove_totp", sub)
        self.totp = False
        return 2

    def delete_user(self, sub):
        self._call("delete_user", sub)

    def send_password_reset(self, email):
        self._call("send_password_reset", email)


@pytest.fixture
def auth0(monkeypatch):
    fake = FakeAuth0()
    for name in ("configured", "has_totp", "remove_totp", "delete_user", "send_password_reset"):
        monkeypatch.setattr(auth0_api, name, getattr(fake, name))
    return fake


def act_as(sub, email="ana@example.com", roles=(), mfa=False):
    app.dependency_overrides[authenticate] = lambda: {"auth0_sub": sub, "email": email, "display_name": None}
    app.dependency_overrides[caller_access] = lambda: {"roles": set(roles), "mfa": mfa}


@pytest.fixture
def client(auth0):
    app.dependency_overrides[get_conn] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()


# --- GET /account ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "sub,method,can_change",
    [
        ("auth0|65f1", "password", True),
        ("google-oauth2|1082", "google", False),
        ("github|12", "github", False),
        ("email|65f1", "email_code", False),
        ("samlp|x", "other", False),
    ],
)
def test_account_says_how_you_sign_in(client, sub, method, can_change):
    act_as(sub)
    body = client.get("/account").json()
    assert body["login_method"] == method
    assert body["can_change_password"] is can_change
    assert body["email"] == "ana@example.com"
    assert body["mfa"] == {"available": True, "enabled": False, "required": False}
    assert body["can_delete"] is True


def test_account_shows_2fa_on_and_required_for_admins(client, auth0):
    auth0.totp = True
    act_as("auth0|admin", roles={"admin"}, mfa=True)
    assert client.get("/account").json()["mfa"] == {"available": True, "enabled": True, "required": True}


def test_account_without_the_management_api(client, auth0):
    auth0.is_configured = False
    act_as("auth0|65f1")
    body = client.get("/account").json()
    assert body["mfa"] == {"available": False, "enabled": None, "required": False}
    assert body["can_delete"] is False
    assert body["can_change_password"] is True  # the reset email needs no Management API
    assert auth0.calls == []


def test_account_when_auth0_is_down(client, auth0):
    auth0.error = Auth0Error("Auth0 could not be reached: URLError")
    act_as("auth0|65f1")
    r = client.get("/account")
    assert r.status_code == 200
    assert r.json()["mfa"] == {"available": True, "enabled": None, "required": False}


def test_dev_user_has_no_auth0_account(client, auth0):
    act_as("dev|alice", email=None)
    body = client.get("/account").json()
    assert body["login_method"] == "dev"
    assert body["mfa"]["available"] is False
    assert body["can_change_password"] is False
    assert body["can_delete"] is True
    assert auth0.calls == []


# --- POST /account/password-reset -----------------------------------------------------------


def test_password_reset_sends_the_email(client, auth0):
    act_as("auth0|65f1", email="ana@example.com")
    r = client.post("/account/password-reset")
    assert r.status_code == 202
    assert r.json() == {"sent_to": "ana@example.com"}
    assert auth0.calls == [("send_password_reset", "ana@example.com")]


@pytest.mark.parametrize(
    "sub,how",
    [("google-oauth2|1", "Google"), ("email|1", "a code sent to your email"), ("github|1", "GitHub")],
)
def test_no_password_to_change_without_a_password_login(client, auth0, sub, how):
    act_as(sub)
    r = client.post("/account/password-reset")
    assert r.status_code == 409
    assert r.json() == {"detail": f"this account has no password: you sign in with {how}"}
    assert auth0.calls == []


def test_password_reset_when_auth0_fails(client, auth0):
    auth0.error = Auth0Error("Auth0 answered HTTP 429: Too Many Requests", status=429)
    act_as("auth0|65f1")
    r = client.post("/account/password-reset")
    assert r.status_code == 503
    assert r.json() == {"detail": account.AUTH0_DOWN}


# --- DELETE /account/mfa ----------------------------------------------------------------------


def test_turn_off_2fa(client, auth0):
    auth0.totp = True
    act_as("auth0|65f1", mfa=True)
    r = client.delete("/account/mfa")
    assert r.status_code == 200
    assert r.json() == {"available": True, "enabled": False, "required": False}
    assert ("remove_totp", "auth0|65f1") in auth0.calls
    assert client.get("/account").json()["mfa"]["enabled"] is False


def test_turning_2fa_off_needs_a_login_with_the_code(client, auth0):
    """A session that never showed the second factor cannot remove it."""
    auth0.totp = True
    act_as("auth0|65f1", mfa=False)
    r = client.delete("/account/mfa")
    assert r.status_code == 403
    assert r.json() == {"detail": account.MFA_STEP_UP}
    assert auth0.totp is True


def test_admins_cannot_turn_2fa_off(client, auth0):
    auth0.totp = True
    act_as("auth0|admin", roles={"admin"}, mfa=True)
    r = client.delete("/account/mfa")
    assert r.status_code == 409
    assert r.json() == {"detail": account.MFA_REQUIRED_FOR_ADMINS}
    assert auth0.totp is True


def test_turning_off_2fa_that_is_not_on(client, auth0):
    act_as("auth0|65f1", mfa=True)
    r = client.delete("/account/mfa")
    assert r.status_code == 409
    assert r.json() == {"detail": account.MFA_NOT_ON}


def test_2fa_off_without_the_management_api(client, auth0):
    from services.auth0_api import Auth0NotConfigured

    auth0.error = Auth0NotConfigured()
    act_as("auth0|65f1", mfa=True)
    r = client.delete("/account/mfa")
    assert r.status_code == 503
    assert r.json() == {"detail": account.NOT_SET_UP}


# --- DELETE /account (real schema, rolled back) -----------------------------------------------


@pytest.fixture(scope="module")
def connection():
    if not settings.DATABASE_URL or settings.APP_ENV != "dev":
        pytest.skip("needs DATABASE_URL and APP_ENV=dev")
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
    """The test connection. commit and rollback are recorded, never run: nothing is saved."""
    connection.done = []
    connection.commit = lambda: connection.done.append("commit")
    real_rollback = type(connection).rollback
    connection.rollback = lambda: connection.done.append("rollback")
    try:
        yield connection
    finally:
        del connection.commit, connection.rollback
        real_rollback(connection)


@pytest.fixture
def db_client(conn, auth0):
    app.dependency_overrides[get_conn] = lambda: conn
    yield TestClient(app)
    app.dependency_overrides.clear()


def new_user(conn, sub=None):
    sub = sub or f"google-oauth2|test-{uuid.uuid4().hex[:10]}"
    row = conn.execute(
        "insert into users (auth0_sub, display_name, email) values (%s, 'Test', 'test@example.com') returning id",
        (sub,),
    ).fetchone()
    return sub, row["id"]


def count(conn, table, user_id):
    return conn.execute(f"select count(*) as n from {table} where user_id = %s", (user_id,)).fetchone()["n"]


def new_event(conn):
    return conn.execute(
        "insert into events (title, venue, starts_at, slot, description) "
        "values ('Test event', 'Test venue', %s, 'weekend_evening', 'x') returning id",
        (datetime(2099, 5, 16, 19, 0, tzinfo=timezone.utc),),
    ).fetchone()["id"]


def new_group(conn, event_id, user_ids):
    group_id = conn.execute(
        "insert into event_groups (event_id, meet_at, note) values (%s, now(), 'x') returning id", (event_id,)
    ).fetchone()["id"]
    for uid in user_ids:
        conn.execute(
            "insert into event_signups (event_id, user_id, status) values (%s, %s, 'grouped')", (event_id, uid)
        )
        conn.execute("insert into group_members (group_id, user_id) values (%s, %s)", (group_id, uid))
    return group_id


def test_delete_removes_our_data_then_the_auth0_user(db_client, conn, auth0):
    sub, user_id = new_user(conn)
    conn.execute(
        "insert into lease_analyses (user_id, neighbourhood, rent_eur, rooms, lease_text_redacted, result_json, price_verdict)"
        " values (%s, 'Test', 400, 2, 'text', '{}', '{}')",
        (user_id,),
    )
    conn.execute("insert into user_availability (user_id, slot) values (%s, 'weekday_evening')", (user_id,))
    conn.execute(
        "insert into student_verifications (user_id, university, student_email, code_hash, expires_at)"
        " values (%s, 'uvt', 'a@e-uvt.ro', 'h', now())",
        (user_id,),
    )
    act_as(sub)

    r = db_client.delete("/account")
    assert r.status_code == 204
    assert conn.execute("select 1 from users where id = %s", (user_id,)).fetchone() is None
    for table in ("lease_analyses", "user_availability", "student_verifications", "event_signups"):
        assert count(conn, table, user_id) == 0
    assert auth0.calls == [("delete_user", sub)]
    assert conn.done == ["commit"]


def test_delete_frees_the_student_email_for_another_account(db_client, conn, auth0):
    sub, user_id = new_user(conn)
    email = f"free{uuid.uuid4().hex[:8]}@e-uvt.ro"
    conn.execute(
        "update users set is_student = true, university = 'uvt', student_email = %s, student_verified_at = now()"
        " where id = %s",
        (email, user_id),
    )
    act_as(sub)
    assert db_client.delete("/account").status_code == 204
    _, other = new_user(conn)
    conn.execute("update users set student_email = %s where id = %s", (email, other))  # no unique violation


def test_auth0_failure_keeps_the_account(db_client, conn, auth0):
    sub, _ = new_user(conn)
    auth0.error = Auth0Error("Auth0 answered HTTP 403: Insufficient scope", status=403)
    act_as(sub)
    r = db_client.delete("/account")
    assert r.status_code == 503
    assert r.json() == {"detail": account.AUTH0_DOWN}
    assert conn.done == ["rollback"]  # our deletes are undone, nothing committed


def test_delete_refused_when_the_management_api_is_not_set_up(db_client, conn, auth0):
    sub, user_id = new_user(conn)
    auth0.is_configured = False
    act_as(sub)
    r = db_client.delete("/account")
    assert r.status_code == 503
    assert r.json() == {"detail": account.NOT_SET_UP}
    assert conn.execute("select 1 from users where id = %s", (user_id,)).fetchone() is not None
    assert auth0.calls == []


def test_dev_user_is_deleted_without_calling_auth0(db_client, conn, auth0):
    auth0.is_configured = False
    sub, user_id = new_user(conn, f"dev|test-{uuid.uuid4().hex[:8]}")
    act_as(sub, email=None)
    assert db_client.delete("/account").status_code == 204
    assert conn.execute("select 1 from users where id = %s", (user_id,)).fetchone() is None
    assert auth0.calls == []


def test_delete_without_a_users_row_still_deletes_the_login(db_client, conn, auth0):
    act_as(f"google-oauth2|never-seen-{uuid.uuid4().hex[:8]}")
    assert db_client.delete("/account").status_code == 204
    assert [c[0] for c in auth0.calls] == ["delete_user"]


def test_group_of_three_is_dissolved_when_a_member_deletes_the_account(db_client, conn, auth0):
    event_id = new_event(conn)
    (sub, me), (_, a), (_, b) = new_user(conn), new_user(conn), new_user(conn)
    group_id = new_group(conn, event_id, [me, a, b])
    act_as(sub)
    assert db_client.delete("/account").status_code == 204

    assert conn.execute("select 1 from event_groups where id = %s", (group_id,)).fetchone() is None
    statuses = {
        r["user_id"]: r["status"]
        for r in conn.execute("select user_id, status from event_signups where event_id = %s", (event_id,))
    }
    assert statuses == {a: "waiting", b: "waiting"}  # back on the list; the deleted user is gone


def test_group_of_four_goes_on_with_three(db_client, conn, auth0):
    event_id = new_event(conn)
    (sub, me), (_, a), (_, b), (_, c) = (new_user(conn) for _ in range(4))
    group_id = new_group(conn, event_id, [me, a, b, c])
    act_as(sub)
    assert db_client.delete("/account").status_code == 204

    members = {r["user_id"] for r in conn.execute("select user_id from group_members where group_id = %s", (group_id,))}
    assert members == {a, b, c}
    statuses = {r["status"] for r in conn.execute("select status from event_signups where event_id = %s", (event_id,))}
    assert statuses == {"grouped"}
