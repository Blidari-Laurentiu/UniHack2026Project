"""Student verification: rules (no DB) and the endpoints against the real schema.

The endpoint tests run inside one transaction that is rolled back, and apply
db/schema/05_student.sql inside it, so the shared database is never changed.
Skipped without DATABASE_URL and APP_ENV=dev. Email sending is replaced by a fake.
"""

import uuid
from contextlib import nullcontext
from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from config import settings
from db import get_conn, get_connector
from main import app
from routers import student as student_router
from services import student as rules

SCHEMA = Path(__file__).resolve().parents[2] / "db" / "schema" / "05_student.sql"


# --- Rules (no database) ------------------------------------------------------------------


@pytest.mark.parametrize(
    "slug,email,ok",
    [
        ("uvt", "ana.pop03@e-uvt.ro", True),
        ("upt", "ana.pop@student.upt.ro", True),
        ("umft", "ana.pop@student.umft.ro", True),
        ("uvt", "ana@uvt.ro", False),  # staff domain
        ("upt", "ana@upt.ro", False),  # staff domain
        ("uvt", "ana@student.upt.ro", False),  # another university
        ("uvt", "ana@evil-e-uvt.ro", False),
        ("uvt", "ana@e-uvt.ro.evil.com", False),
        ("uvt", "e-uvt.ro", False),
        ("uvt", "a b@e-uvt.ro", False),
        ("uvt", "a@b@e-uvt.ro", False),
    ],
)
def test_email_must_be_a_student_mailbox_of_that_university(slug, email, ok):
    assert rules.email_matches(rules.BY_SLUG[slug], rules.normalize_email(email)) is ok


def test_codes_are_six_digits_and_hashed_per_row():
    code = rules.new_code()
    assert len(code) == 6 and code.isdigit()
    a, b = uuid.uuid4(), uuid.uuid4()
    assert rules.code_matches(a, code, rules.hash_code(a, code))
    assert not rules.code_matches(b, code, rules.hash_code(a, code))
    assert code not in rules.hash_code(a, code)


# --- Endpoints ------------------------------------------------------------------------------

db = pytest.mark.skipif(
    not settings.DATABASE_URL or settings.APP_ENV != "dev", reason="needs DATABASE_URL and APP_ENV=dev"
)


@pytest.fixture(scope="module")
def connection():
    if not settings.DATABASE_URL or settings.APP_ENV != "dev":
        pytest.skip("needs DATABASE_URL and APP_ENV=dev")
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
    connection.execute(SCHEMA.read_text(encoding="utf-8"))  # rolled back with the test
    try:
        yield connection
    finally:
        connection.rollback()


@pytest.fixture
def outbox(monkeypatch):
    """Captures sent emails instead of using SMTP. Set .error to make sending fail."""

    class Outbox(list):
        error = None

        def send(self, to, subject, text):
            if self.error:
                raise self.error
            self.append({"to": to, "subject": subject, "text": text})

        @property
        def code(self):
            return self[-1]["subject"].rsplit(" ", 1)[1]

    box = Outbox()
    monkeypatch.setattr(student_router, "send_email", box.send)
    monkeypatch.setattr(student_router, "mail_configured", lambda: True)
    return box


@pytest.fixture
def client(conn, outbox):
    app.dependency_overrides[get_conn] = lambda: conn
    app.dependency_overrides[get_connector] = lambda: lambda: nullcontext(conn)
    yield TestClient(app)
    app.dependency_overrides.clear()


def user():
    return {"X-Dev-User": f"test-student-{uuid.uuid4().hex[:8]}"}


def tag():
    return uuid.uuid4().hex[:8]


def age_codes(conn, seconds):
    """Pretend the codes were sent `seconds` ago (skips the 60 s resend wait)."""
    conn.execute(
        "update student_verifications set created_at = created_at - make_interval(secs => %s)",
        (seconds,),
    )


def start(client, headers, email, university="uvt"):
    return client.post("/student/start", headers=headers, json={"university": university, "email": email})


def test_universities_are_public(client):
    r = client.get("/student/universities")
    assert r.status_code == 200
    assert {"slug": "uvt", "name": rules.BY_SLUG["uvt"].name, "domains": ["e-uvt.ro"]} in r.json()


def test_status_needs_login(client):
    assert client.get("/student/status").status_code == 401
    assert client.post("/student/start", json={"university": "uvt", "email": "a@e-uvt.ro"}).status_code == 401
    assert client.post("/student/confirm", json={"code": "123456"}).status_code == 401


def test_new_user_is_not_a_student(client):
    r = client.get("/student/status", headers=user())
    assert r.status_code == 200
    assert r.json() == {"is_student": False, "university": None, "student_email": None,
                        "verified_at": None, "expires_at": None, "expired": False, "pending": None}


def test_full_flow_makes_a_student(client, outbox):
    h, email = user(), f"Ana.Pop{tag()}@E-UVT.ro "
    r = start(client, h, email)
    assert r.status_code == 202
    assert r.json()["pending"]["student_email"] == email.strip().lower()
    assert r.json()["is_student"] is False
    assert outbox[-1]["to"] == email.strip().lower()
    assert outbox.code in outbox[-1]["text"]

    r = client.post("/student/confirm", headers=h, json={"code": f" {outbox.code[:3]} {outbox.code[3:]} "})
    assert r.status_code == 200
    body = r.json()
    assert body["is_student"] is True
    assert body["university"] == "uvt"
    assert body["student_email"] == email.strip().lower()
    assert body["verified_at"] is not None
    assert body["pending"] is None

    assert client.get("/me", headers=h).json()["is_student"] is True
    assert client.get("/profile", headers=h).json()["is_student"] is True
    # The code works once.
    assert client.post("/student/confirm", headers=h, json={"code": outbox.code}).status_code == 409


@pytest.mark.parametrize(
    "university,email,detail",
    [
        ("uvt", "ana@uvt.ro", "use your student email for UVT (@e-uvt.ro)"),
        ("upt", "ana@e-uvt.ro", "use your student email for UPT (@student.upt.ro)"),
        ("harvard", "ana@harvard.edu", "unknown university"),
        # One mailbox, one account: a +tag would let the same mailbox verify many accounts.
        ("uvt", "ana.pop+second@e-uvt.ro", "use your university email without a +tag"),
    ],
)
def test_wrong_university_email_is_refused_and_nothing_is_sent(client, outbox, university, email, detail):
    r = start(client, user(), email, university)
    assert r.status_code == 422
    assert r.json() == {"detail": detail}
    assert outbox == []


def test_wrong_code_counts_down_then_locks(client, outbox):
    h = user()
    start(client, h, f"x{tag()}@e-uvt.ro")
    wrong = "000000" if outbox.code != "000000" else "111111"
    for left in (4, 3, 2, 1):
        r = client.post("/student/confirm", headers=h, json={"code": wrong})
        assert r.status_code == 400
        assert r.json()["detail"] == f"wrong code, {left} {'try' if left == 1 else 'tries'} left"
    r = client.post("/student/confirm", headers=h, json={"code": wrong})
    assert r.status_code == 429
    # Locked: even the right code no longer works, and the status has no pending code.
    r = client.post("/student/confirm", headers=h, json={"code": outbox.code})
    assert r.status_code == 429
    assert client.get("/student/status", headers=h).json()["pending"] is None


@pytest.mark.parametrize("code", ["abc", "12345", "1234567", "12345a"])
def test_malformed_code_is_a_wrong_code(client, outbox, code):
    h = user()
    start(client, h, f"x{tag()}@e-uvt.ro")
    r = client.post("/student/confirm", headers=h, json={"code": code})
    assert r.status_code == 400
    assert r.json()["detail"].startswith("wrong code")


def test_expired_code_is_refused(client, conn, outbox):
    h = user()
    start(client, h, f"x{tag()}@e-uvt.ro")
    conn.execute("update student_verifications set expires_at = now() - interval '1 second'")
    r = client.post("/student/confirm", headers=h, json={"code": outbox.code})
    assert r.status_code == 400
    assert r.json() == {"detail": student_router.CODE_EXPIRED}


def test_confirm_without_a_code(client):
    r = client.post("/student/confirm", headers=user(), json={"code": "123456"})
    assert r.status_code == 400
    assert r.json() == {"detail": student_router.NO_CODE}


def test_resend_waits_a_minute_and_only_the_newest_code_works(client, conn, outbox):
    h, email = user(), f"x{tag()}@e-uvt.ro"
    start(client, h, email)
    first = outbox.code
    r = start(client, h, email)
    assert r.status_code == 429
    assert r.json()["detail"].startswith("wait ") and r.json()["detail"].endswith(" seconds before asking for a new code")

    age_codes(conn, 61)
    assert start(client, h, email).status_code == 202
    second = outbox.code
    if first != second:
        assert client.post("/student/confirm", headers=h, json={"code": first}).status_code == 400
    assert client.post("/student/confirm", headers=h, json={"code": second}).status_code == 200


def test_at_most_five_codes_an_hour(client, conn, outbox):
    h, email = user(), f"x{tag()}@e-uvt.ro"
    for _ in range(5):
        assert start(client, h, email).status_code == 202
        age_codes(conn, 61)
    r = start(client, h, email)
    assert r.status_code == 429
    assert r.json() == {"detail": "too many codes in the last hour, try again later"}
    assert len(outbox) == 5


def test_one_university_email_makes_only_one_account_a_student(client, outbox):
    email = f"shared{tag()}@student.upt.ro"
    first, second = user(), user()
    start(client, first, email, "upt")
    assert client.post("/student/confirm", headers=first, json={"code": outbox.code}).status_code == 200

    r = start(client, second, email, "upt")
    assert r.status_code == 409
    assert r.json() == {"detail": student_router.EMAIL_TAKEN}


def test_email_taken_while_the_code_was_pending(client, outbox):
    """Two accounts ask for the same email; the second to confirm gets 409."""
    email = f"race{tag()}@e-uvt.ro"
    a, b = user(), user()
    start(client, a, email)
    code_a = outbox.code
    start(client, b, email)
    code_b = outbox.code
    assert client.post("/student/confirm", headers=b, json={"code": code_b}).status_code == 200
    r = client.post("/student/confirm", headers=a, json={"code": code_a})
    assert r.status_code == 409


def test_a_student_cannot_start_again(client, outbox):
    h = user()
    start(client, h, f"x{tag()}@e-uvt.ro")
    client.post("/student/confirm", headers=h, json={"code": outbox.code})
    r = start(client, h, f"y{tag()}@e-uvt.ro")
    assert r.status_code == 409
    assert r.json() == {"detail": student_router.ALREADY_STUDENT}


def test_failed_email_gives_503_and_leaves_no_code(client, outbox):
    h = user()
    outbox.error = OSError("connection refused")
    r = start(client, h, f"x{tag()}@e-uvt.ro")
    assert r.status_code == 503
    assert r.json() == {"detail": student_router.MAIL_DOWN}
    assert client.get("/student/status", headers=h).json()["pending"] is None
    outbox.error = None
    assert start(client, h, f"x{tag()}@e-uvt.ro").status_code == 202  # no resend wait after a failure


def test_without_smtp_production_refuses(client, monkeypatch, outbox):
    from auth import authenticate

    monkeypatch.setattr(student_router, "mail_configured", lambda: False)
    monkeypatch.setattr(settings, "APP_ENV", "production")
    sub = f"google-oauth2|{tag()}"
    app.dependency_overrides[authenticate] = lambda: {"auth0_sub": sub, "email": None, "display_name": None}
    r = client.post("/student/start", json={"university": "uvt", "email": f"x{tag()}@e-uvt.ro"})
    assert r.status_code == 503
    assert r.json() == {"detail": student_router.MAIL_NOT_SET_UP}
    assert outbox == []


def test_without_smtp_dev_logs_the_code(client, monkeypatch, caplog):
    def not_configured(*args):
        raise student_router.MailNotConfigured()

    monkeypatch.setattr(student_router, "send_email", not_configured)
    h = user()
    with caplog.at_level("WARNING", logger="uvicorn.error"):
        assert start(client, h, f"x{tag()}@e-uvt.ro").status_code == 202
    assert "DEV: student verification code" in caplog.text


def test_token_student_claim_no_longer_makes_a_student(client):
    """is_student used to come from the Action; now only the code flow sets it."""
    h = user()
    assert client.get("/me", headers=h).json()["is_student"] is False


def test_old_claim_based_students_are_reset_by_the_schema(conn):
    sub = f"google-oauth2|old-{tag()}"
    seed = f"seed|t{tag()}"
    conn.execute("insert into users (auth0_sub, is_student) values (%s, true), (%s, true)", (sub, seed))
    conn.execute(SCHEMA.read_text(encoding="utf-8"))
    rows = {r["auth0_sub"]: r["is_student"] for r in conn.execute(
        "select auth0_sub, is_student from users where auth0_sub = any(%s)", ([sub, seed],))}
    assert rows == {sub: False, seed: True}


# --- Valid for one year ---------------------------------------------------------------------


def verify(client, outbox, headers, email, university="uvt"):
    assert start(client, headers, email, university).status_code == 202
    r = client.post("/student/confirm", headers=headers, json={"code": outbox.code})
    assert r.status_code == 200
    return r.json()


def age_verification(conn, email, interval):
    conn.execute(
        "update users set student_verified_at = now() - %s::interval where student_email = %s",
        (interval, email),
    )


def test_status_says_when_it_ends(client, outbox):
    from datetime import datetime, timedelta, timezone

    body = verify(client, outbox, user(), f"x{tag()}@e-uvt.ro")
    ends = datetime.fromisoformat(body["expires_at"])
    assert timedelta(days=364) < ends - datetime.now(timezone.utc) < timedelta(days=367)
    assert body["expired"] is False


def test_still_a_student_after_eleven_months(client, conn, outbox):
    h, email = user(), f"x{tag()}@e-uvt.ro"
    verify(client, outbox, h, email)
    age_verification(conn, email, "11 months")
    assert client.get("/me", headers=h).json()["is_student"] is True
    assert client.get("/student/status", headers=h).json()["expired"] is False


def test_after_a_year_the_status_ends_everywhere(client, conn, outbox):
    h, email = user(), f"x{tag()}@e-uvt.ro"
    verify(client, outbox, h, email)
    age_verification(conn, email, "1 year 1 day")

    assert client.get("/me", headers=h).json()["is_student"] is False
    assert client.get("/profile", headers=h).json()["is_student"] is False
    status = client.get("/student/status", headers=h).json()
    assert status["is_student"] is False
    assert status["expired"] is True
    assert status["student_email"] == email and status["university"] == "uvt"  # kept, to verify again


def test_expired_badge_is_gone_from_the_group_card(client, conn, outbox):
    """Other people see it too: the group members query reads the same rule."""
    from routers.events import _load_groups

    h, email = user(), f"x{tag()}@e-uvt.ro"
    verify(client, outbox, h, email)
    me = client.get("/me", headers=h).json()["id"]
    event_id = conn.execute(
        "insert into events (title, venue, starts_at, slot, description) "
        "values ('Test', 'Test', now() + interval '30 days', 'weekend_evening', 'x') returning id"
    ).fetchone()["id"]
    group_id = conn.execute(
        "insert into event_groups (event_id, meet_at, note) values (%s, now(), 'x') returning id", (event_id,)
    ).fetchone()["id"]
    conn.execute("insert into group_members (group_id, user_id) values (%s, %s)", (group_id, me))

    assert _load_groups(conn, [group_id])[0].members[0].is_student is True
    age_verification(conn, email, "1 year 1 day")
    assert _load_groups(conn, [group_id])[0].members[0].is_student is False


def test_verify_again_after_it_expired(client, conn, outbox):
    h, email = user(), f"x{tag()}@e-uvt.ro"
    verify(client, outbox, h, email)
    age_verification(conn, email, "13 months")
    conn.execute("update student_verifications set created_at = created_at - interval '13 months'")

    body = verify(client, outbox, h, email)  # the same mailbox is still theirs
    assert body["is_student"] is True and body["expired"] is False
    assert client.get("/me", headers=h).json()["is_student"] is True


def test_expired_email_still_belongs_to_its_account(client, conn, outbox):
    """An expired student keeps the mailbox: another account cannot take it."""
    email = f"x{tag()}@e-uvt.ro"
    verify(client, outbox, user(), email)
    age_verification(conn, email, "2 years")
    r = start(client, user(), email)
    assert r.status_code == 409
    assert r.json() == {"detail": student_router.EMAIL_TAKEN}


def test_cannot_renew_before_it_expires(client, conn, outbox):
    h, email = user(), f"x{tag()}@e-uvt.ro"
    verify(client, outbox, h, email)
    age_verification(conn, email, "11 months")
    conn.execute("update student_verifications set created_at = created_at - interval '11 months'")
    r = start(client, h, email)
    assert r.status_code == 409
    assert r.json() == {"detail": student_router.ALREADY_STUDENT}


def test_sample_users_never_expire(client, conn):
    """Seeded users have the flag without a verification date."""
    name = f"test-seedlike-{tag()}"
    conn.execute("insert into users (auth0_sub, is_student) values (%s, true)", (f"dev|{name}",))
    assert client.get("/me", headers={"X-Dev-User": name}).json()["is_student"] is True
