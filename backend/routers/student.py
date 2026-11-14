"""Student verification (shared, auth): university + university email -> code by email -> student.

is_student is set only here, after the user types the code sent to a student mailbox of the
chosen university. A token claim never sets it (see auth.upsert_user).
"""

import logging
import re

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from auth import authenticate, current_user, dev_bypass_enabled, upsert_user
from db import get_conn, get_connector
from schemas.student import (
    PendingOut,
    StudentConfirmIn,
    StudentStartIn,
    StudentStatusOut,
    UniversityOut,
)
from services.mailer import MailNotConfigured, mail_configured, send_email
from services.student import (
    BY_SLUG,
    CODE_LENGTH,
    CODE_TTL,
    MAX_ATTEMPTS,
    MAX_CODES_PER_HOUR,
    RESEND_AFTER,
    UNIVERSITIES,
    code_matches,
    email_matches,
    hash_code,
    new_code,
    normalize_email,
)

log = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/student", tags=["student"])

ALREADY_STUDENT = "you are already a verified student"
EMAIL_TAKEN = "this university email is already used by another account"
NO_CODE = "no code to confirm, ask for a new one"
CODE_EXPIRED = "this code has expired, ask for a new one"
TOO_MANY_WRONG = "too many wrong codes, ask for a new one"
MAIL_DOWN = "the email could not be sent right now, try again in a few minutes"
MAIL_NOT_SET_UP = "sending email is not set up on the server"


def _status(conn, user_id) -> StudentStatusOut:
    user = conn.execute(
        "select is_student, university, student_email, student_verified_at from users where id = %s",
        (user_id,),
    ).fetchone()
    pending = conn.execute(
        """
        select university, student_email, expires_at, created_at + %s as resend_after
        from student_verifications
        where user_id = %s and used_at is null and expires_at > now() and attempts < %s
        order by created_at desc
        limit 1
        """,
        (RESEND_AFTER, user_id, MAX_ATTEMPTS),
    ).fetchone()
    return StudentStatusOut(
        is_student=bool(user["is_student"]),
        university=user["university"],
        student_email=user["student_email"],
        verified_at=user["student_verified_at"],
        pending=PendingOut(**pending) if pending and not user["is_student"] else None,
    )


def _email_taken(conn, email: str, user_id) -> bool:
    return (
        conn.execute(
            "select 1 from users where student_email = %s and id <> %s", (email, user_id)
        ).fetchone()
        is not None
    )


@router.get("/universities", response_model=list[UniversityOut])
def list_universities():
    """Public: the universities we can verify, with their student email domains."""
    return [UniversityOut(slug=u.slug, name=u.name, domains=list(u.domains)) for u in UNIVERSITIES]


@router.get("/status", response_model=StudentStatusOut)
def get_status(user: dict = Depends(current_user), conn=Depends(get_conn)):
    return _status(conn, user["id"])


@router.post("/start", response_model=StudentStatusOut, status_code=202)
def start(
    body: StudentStartIn,
    identity: dict = Depends(authenticate),
    connect=Depends(get_connector),
):
    """Send a code to the university email. Short connections: the SMTP call can be slow."""
    university = BY_SLUG.get(body.university)
    if university is None:
        raise HTTPException(status_code=422, detail="unknown university")
    email = normalize_email(body.email)
    if not email_matches(university, email):
        domains = " or ".join(f"@{d}" for d in university.domains)
        raise HTTPException(
            status_code=422, detail=f"use your student email for {university.slug.upper()} ({domains})"
        )
    if not mail_configured() and not dev_bypass_enabled():
        raise HTTPException(status_code=503, detail=MAIL_NOT_SET_UP)

    with connect() as conn:
        user = upsert_user(conn, **identity)
        # Lock the user row: concurrent starts for one user run one after the other.
        conn.execute("select 1 from users where id = %s for update", (user["id"],))
        if user["is_student"]:
            raise HTTPException(status_code=409, detail=ALREADY_STUDENT)
        if _email_taken(conn, email, user["id"]):
            raise HTTPException(status_code=409, detail=EMAIL_TAKEN)

        recent = conn.execute(
            """
            select count(*) as n,
                   ceil(extract(epoch from max(created_at) + %s - now())) as wait
            from student_verifications
            where user_id = %s and created_at > now() - interval '1 hour'
            """,
            (RESEND_AFTER, user["id"]),
        ).fetchone()
        if recent["wait"] is not None and recent["wait"] > 0:
            raise HTTPException(
                status_code=429, detail=f"wait {int(recent['wait'])} seconds before asking for a new code"
            )
        if recent["n"] >= MAX_CODES_PER_HOUR:
            raise HTTPException(status_code=429, detail="too many codes in the last hour, try again later")

        # Only the newest code can be used: close the older ones.
        conn.execute(
            "update student_verifications set used_at = now() where user_id = %s and used_at is null",
            (user["id"],),
        )
        code = new_code()
        row = conn.execute(
            """
            insert into student_verifications
                (user_id, university, student_email, code_hash, expires_at)
            values (%s, %s, %s, '', now() + %s)
            returning id
            """,
            (user["id"], university.slug, email, CODE_TTL),
        ).fetchone()
        conn.execute(
            "update student_verifications set code_hash = %s where id = %s",
            (hash_code(row["id"], code), row["id"]),
        )
        conn.commit()

    minutes = int(CODE_TTL.total_seconds() // 60)
    try:
        send_email(
            email,
            f"Your student verification code: {code}",
            f"Your code is {code}\n\n"
            f"Type it on the Newcomer Hub to confirm that you study at {university.name}.\n"
            f"It expires in {minutes} minutes. If you did not ask for it, ignore this email.\n",
        )
    except MailNotConfigured:
        # Dev only (checked above): no SMTP server, so the code goes to the server log.
        log.warning("DEV: student verification code for %s is %s (SMTP_HOST not set)", email, code)
    except (OSError, Exception) as exc:  # smtplib.SMTPException is an OSError
        log.warning("sending the student code failed: %s", type(exc).__name__)
        with connect() as conn:
            conn.execute("delete from student_verifications where id = %s", (row["id"],))
        raise HTTPException(status_code=503, detail=MAIL_DOWN)

    with connect() as conn:
        return _status(conn, user["id"])


@router.post("/confirm", response_model=StudentStatusOut)
def confirm(body: StudentConfirmIn, user: dict = Depends(current_user), conn=Depends(get_conn)):
    """Check the code. Right: the user becomes a student. Wrong: one attempt used."""
    code = re.sub(r"\s", "", body.code)
    if user["is_student"]:
        raise HTTPException(status_code=409, detail=ALREADY_STUDENT)

    row = conn.execute(
        """
        select id, university, student_email, code_hash, attempts, expires_at <= now() as expired
        from student_verifications
        where user_id = %s and used_at is null
        order by created_at desc
        limit 1
        for update
        """,
        (user["id"],),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=400, detail=NO_CODE)
    if row["expired"]:
        raise HTTPException(status_code=400, detail=CODE_EXPIRED)
    if row["attempts"] >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail=TOO_MANY_WRONG)

    if not (code.isdigit() and len(code) == CODE_LENGTH and code_matches(row["id"], code, row["code_hash"])):
        conn.execute(
            "update student_verifications set attempts = attempts + 1 where id = %s", (row["id"],)
        )
        conn.commit()  # keep the attempt even though the request fails
        left = MAX_ATTEMPTS - row["attempts"] - 1
        if left <= 0:
            raise HTTPException(status_code=429, detail=TOO_MANY_WRONG)
        raise HTTPException(
            status_code=400, detail=f"wrong code, {left} {'try' if left == 1 else 'tries'} left"
        )

    if _email_taken(conn, row["student_email"], user["id"]):
        raise HTTPException(status_code=409, detail=EMAIL_TAKEN)
    try:
        conn.execute("update student_verifications set used_at = now() where id = %s", (row["id"],))
        conn.execute(
            """
            update users
            set is_student = true, university = %s, student_email = %s, student_verified_at = now()
            where id = %s
            """,
            (row["university"], row["student_email"], user["id"]),
        )
        conn.commit()
    except psycopg.errors.UniqueViolation:
        conn.rollback()  # another account confirmed the same email a moment ago
        raise HTTPException(status_code=409, detail=EMAIL_TAKEN)
    return _status(conn, user["id"])
