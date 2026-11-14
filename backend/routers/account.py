"""Account settings (shared, auth): change password, two-factor authentication, delete account.

The profile itself (name, interests, free time) is edited through PUT /profile.
Turning 2FA on happens at Auth0 (the frontend logs in again with enroll_mfa=true and the
Post-Login Action shows the enrolment page); this router reports it and turns it off.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Response

from auth import ADMIN_ROLE, authenticate, caller_access
from db import get_conn
from routers.events import remove_from_groups
from schemas.account import AccountOut, MfaOut, PasswordResetOut
from services import auth0_api
from services.auth0_api import Auth0Error, Auth0NotConfigured

log = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/account", tags=["account"])

LOGIN_METHODS = {
    "auth0": "password",
    "google-oauth2": "google",
    "github": "github",
    "email": "email_code",
    "dev": "dev",
}
NO_PASSWORD = "this account has no password: you sign in with {how}"
HOW = {
    "google": "Google",
    "github": "GitHub",
    "email_code": "a code sent to your email",
    "dev": "the dev header",
    "other": "another provider",
}
AUTH0_DOWN = "the login service could not be reached, try again in a few minutes"
NOT_SET_UP = "account management is not set up on the server"
MFA_NOT_ON = "two-factor authentication is not on"
MFA_REQUIRED_FOR_ADMINS = "admin accounts must keep two-factor authentication on"
MFA_STEP_UP = "sign in again with your authenticator code to turn two-factor authentication off"


def login_method(sub: str) -> str:
    """How the account signs in, from the Auth0 id prefix (auth0|..., google-oauth2|...)."""
    return LOGIN_METHODS.get(sub.split("|", 1)[0], "other")


def _auth0_failed(exc: Exception, what: str) -> HTTPException:
    if isinstance(exc, Auth0NotConfigured):
        return HTTPException(status_code=503, detail=NOT_SET_UP)
    log.warning("%s failed: %s", what, exc)  # Auth0's reason, e.g. a missing scope
    return HTTPException(status_code=503, detail=AUTH0_DOWN)


@router.get("", response_model=AccountOut)
def get_account(identity: dict = Depends(authenticate), access: dict = Depends(caller_access)):
    sub = identity["auth0_sub"]
    method = login_method(sub)
    managed = auth0_api.configured() and method != "dev"

    enabled: bool | None = None
    if managed:
        try:
            enabled = auth0_api.has_totp(sub)
        except (Auth0Error, Auth0NotConfigured) as exc:
            log.warning("reading 2FA status failed: %s", exc)

    return AccountOut(
        login_method=method,
        email=identity["email"],
        can_change_password=method == "password" and bool(identity["email"]),
        mfa=MfaOut(available=managed, enabled=enabled, required=ADMIN_ROLE in access["roles"]),
        can_delete=managed or method == "dev",
    )


@router.post("/password-reset", response_model=PasswordResetOut, status_code=202)
def password_reset(identity: dict = Depends(authenticate)):
    """Email the user a link to choose a new password. Only for email + password accounts."""
    method = login_method(identity["auth0_sub"])
    if method != "password":
        raise HTTPException(status_code=409, detail=NO_PASSWORD.format(how=HOW[method]))
    email = identity["email"]
    if not email:
        raise HTTPException(status_code=409, detail="this account has no email address")
    try:
        auth0_api.send_password_reset(email)
    except (Auth0Error, Auth0NotConfigured) as exc:
        raise _auth0_failed(exc, "password reset email")
    return PasswordResetOut(sent_to=email)


@router.delete("/mfa", response_model=MfaOut)
def turn_off_mfa(identity: dict = Depends(authenticate), access: dict = Depends(caller_access)):
    """Remove the authenticator app. The caller must have signed in with it (step-up)."""
    sub = identity["auth0_sub"]
    if login_method(sub) == "dev":
        raise HTTPException(status_code=409, detail=MFA_NOT_ON)
    try:
        if not auth0_api.has_totp(sub):
            raise HTTPException(status_code=409, detail=MFA_NOT_ON)
        if ADMIN_ROLE in access["roles"]:
            raise HTTPException(status_code=409, detail=MFA_REQUIRED_FOR_ADMINS)
        if not access["mfa"]:
            # A stolen session alone must not be able to weaken the login.
            raise HTTPException(status_code=403, detail=MFA_STEP_UP)
        auth0_api.remove_totp(sub)
    except (Auth0Error, Auth0NotConfigured) as exc:
        raise _auth0_failed(exc, "turning 2FA off")
    return MfaOut(available=True, enabled=False, required=False)


@router.delete("", status_code=204)
def delete_account(identity: dict = Depends(authenticate), conn=Depends(get_conn)):
    """Delete everything we hold about the caller, then the Auth0 login itself.

    Our rows go first, uncommitted; the commit happens only after Auth0 deleted the user,
    so a failure on either side leaves the account whole.
    """
    sub = identity["auth0_sub"]
    is_dev = login_method(sub) == "dev"  # dev users exist only in our database
    if not is_dev and not auth0_api.configured():
        raise HTTPException(status_code=503, detail=NOT_SET_UP)

    user = conn.execute("select id from users where auth0_sub = %s for update", (sub,)).fetchone()
    if user is not None:
        # Same order as leaving an event: lock the events, leave the groups (a group under
        # three is dissolved), then the row. Saved lease checks, signups, the profile and
        # student verifications go with it (on delete cascade).
        conn.execute(
            """
            select e.id from events e join event_signups s on s.event_id = e.id
            where s.user_id = %s order by e.id for update of e
            """,
            (user["id"],),
        )
        remove_from_groups(conn, user["id"])
        conn.execute("delete from users where id = %s", (user["id"],))

    if not is_dev:
        try:
            auth0_api.delete_user(sub)
        except (Auth0Error, Auth0NotConfigured) as exc:
            conn.rollback()
            raise _auth0_failed(exc, "deleting the Auth0 user")
    conn.commit()
    return Response(status_code=204)
