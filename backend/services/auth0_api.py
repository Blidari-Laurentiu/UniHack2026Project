"""Calls from our server to Auth0, for the account settings. Standard library only.

- Management API, as a Machine to Machine application (AUTH0_MGMT_CLIENT_ID/SECRET):
  list and remove a user's authenticator app (2FA), delete the Auth0 user.
- Authentication API (no credentials): send the "change password" email.

Turning 2FA *on* needs no call from here: the frontend logs in again with the parameter
enroll_mfa=true and the Post-Login Action shows the enrolment page.
"""

import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from config import settings

log = logging.getLogger("uvicorn.error")

TIMEOUT_SECONDS = 10
TOKEN_MARGIN_SECONDS = 60
TOTP = "totp"  # an authenticator app; the only second factor this app offers
RECOVERY_CODE = "recovery-code"  # made with the first factor, useless without one


class Auth0NotConfigured(Exception):
    """AUTH0_DOMAIN, AUTH0_MGMT_CLIENT_ID or AUTH0_MGMT_CLIENT_SECRET is empty."""


class Auth0Error(OSError):
    """Auth0 refused or could not be reached. The message never contains a secret."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


_token_lock = threading.Lock()
_token: dict = {"value": None, "expires_at": 0.0}


def configured() -> bool:
    return bool(
        settings.AUTH0_DOMAIN and settings.AUTH0_MGMT_CLIENT_ID and settings.AUTH0_MGMT_CLIENT_SECRET
    )


def _http(method: str, url: str, body: dict | None = None, token: str | None = None):
    """One JSON request. Returns the parsed body (None when empty). Raises Auth0Error."""
    headers = {"accept": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["content-type"] = "application/json"
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        raw = exc.read() or b""
        try:
            parsed = json.loads(raw)
            detail = parsed.get("message") or parsed.get("error_description") or parsed.get("error")
        except (ValueError, AttributeError):
            detail = raw.decode("utf-8", "replace")[:200]
        raise Auth0Error(f"Auth0 answered HTTP {exc.code}: {detail}", status=exc.code) from None
    except (urllib.error.URLError, TimeoutError) as exc:
        raise Auth0Error(f"Auth0 could not be reached: {type(exc).__name__}") from None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return raw.decode("utf-8", "replace")


def _management_token(force: bool = False) -> str:
    """A cached Management API token (client credentials), renewed a minute before it ends."""
    if not configured():
        raise Auth0NotConfigured()
    with _token_lock:
        if not force and _token["value"] and time.monotonic() < _token["expires_at"]:
            return _token["value"]
        answer = _http(
            "POST",
            f"https://{settings.AUTH0_DOMAIN}/oauth/token",
            {
                "grant_type": "client_credentials",
                "client_id": settings.AUTH0_MGMT_CLIENT_ID,
                "client_secret": settings.AUTH0_MGMT_CLIENT_SECRET,
                "audience": f"https://{settings.AUTH0_DOMAIN}/api/v2/",
            },
        )
        if not isinstance(answer, dict) or not answer.get("access_token"):
            raise Auth0Error("Auth0 gave no Management API token")
        lifetime = float(answer.get("expires_in") or 0)
        _token["value"] = answer["access_token"]
        _token["expires_at"] = time.monotonic() + max(0.0, lifetime - TOKEN_MARGIN_SECONDS)
        return _token["value"]


def _management(method: str, path: str, body: dict | None = None):
    """A Management API call. One retry with a new token when Auth0 says 401."""
    url = f"https://{settings.AUTH0_DOMAIN}/api/v2{path}"
    try:
        return _http(method, url, body, token=_management_token())
    except Auth0Error as exc:
        if exc.status != 401:
            raise
    return _http(method, url, body, token=_management_token(force=True))


def _user_path(sub: str) -> str:
    # Auth0 ids contain "|" (google-oauth2|123): it must be percent-encoded in the path.
    return f"/users/{urllib.parse.quote(sub, safe='')}"


def _methods(sub: str) -> list[dict]:
    answer = _management("GET", f"{_user_path(sub)}/authentication-methods?per_page=100")
    if isinstance(answer, dict):  # the paged shape, in case Auth0 sends it
        answer = answer.get("authenticators")
    return [m for m in answer or [] if isinstance(m, dict)]


def has_totp(sub: str) -> bool:
    """True when the user has a confirmed authenticator app. Scope read:authentication_methods."""
    return any(m.get("type") == TOTP and m.get("confirmed") is not False for m in _methods(sub))


def remove_totp(sub: str) -> int:
    """Remove the user's authenticator app and its recovery code; returns how many were removed.

    Deletes those methods one by one, so a password or passkey is never touched.
    Scopes read:authentication_methods and delete:authentication_methods.
    """
    removed = 0
    for method in _methods(sub):
        if method.get("type") in (TOTP, RECOVERY_CODE) and method.get("id"):
            method_id = urllib.parse.quote(str(method["id"]), safe="")
            _management("DELETE", f"{_user_path(sub)}/authentication-methods/{method_id}")
            removed += 1
    return removed


def delete_user(sub: str) -> None:
    """Delete the Auth0 user, so the login is gone too. Scope delete:users."""
    _management("DELETE", _user_path(sub))  # 204 also when the user is already gone


def send_password_reset(email: str) -> None:
    """Have Auth0 email a "change your password" link. Database connection users only."""
    if not settings.AUTH0_DOMAIN:
        raise Auth0NotConfigured()
    _http(
        "POST",
        f"https://{settings.AUTH0_DOMAIN}/dbconnections/change_password",
        {"email": email, "connection": settings.AUTH0_DB_CONNECTION},
    )
