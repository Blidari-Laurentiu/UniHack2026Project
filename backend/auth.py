"""Auth0 access-token verification and the current_user dependency.

Tokens are RS256 JWTs signed by Auth0; signing keys come from the tenant's
JWKS endpoint through one cached PyJWKClient.

Dev bypass: when APP_ENV == "dev" (and only then), the header
`X-Dev-User: <name>` skips JWT verification and acts as user "dev|<name>".
With it, `X-Dev-Roles: admin,moderator` sets the caller's roles.

Verified email: a token is only accepted when EMAIL_VERIFIED_CLAIM is true (set by the
Post-Login Action from Auth0's email_verified). Otherwise every authed endpoint answers
403 EMAIL_NOT_VERIFIED, so a new password account cannot use the app until the user
clicks the link in Auth0's verification email and signs in again.

Roles: an Auth0 Post-Login Action copies the user's roles into the access token
(ROLES_CLAIM) and sets MFA_CLAIM when the login included a second factor. Guard an
endpoint with `Depends(require_role("admin"))`. An admin account is refused on guarded
endpoints unless its token says the login used multi-factor authentication.
effective_roles() gives the roles of a caller for endpoints that are open to everyone but
do more for some roles (creating events).
"""

import logging
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from config import settings
from db import get_conn
from services.student import active_sql

log = logging.getLogger("uvicorn.error")

EMAIL_CLAIM = "https://newcomer-hub/email"
EMAIL_VERIFIED_CLAIM = "https://newcomer-hub/email_verified"
EMAIL_NOT_VERIFIED = "verify your email address first"
ROLES_CLAIM = "https://newcomer-hub/roles"
MFA_CLAIM = "https://newcomer-hub/mfa"
ADMIN_ROLE = "admin"
MODERATOR_ROLE = "moderator"
CREATOR_ROLE = "creator"  # no daily limit on creating events, published without review
DEV_HEADER = "X-Dev-User"
DEV_ROLES_HEADER = "X-Dev-Roles"
DEV_NAME_MAX = 64

bearer_scheme = HTTPBearer(auto_error=False)
dev_user_scheme = APIKeyHeader(name=DEV_HEADER, auto_error=False)
dev_roles_scheme = APIKeyHeader(name=DEV_ROLES_HEADER, auto_error=False)


def dev_bypass_enabled() -> bool:
    return settings.APP_ENV == "dev"


if dev_bypass_enabled():
    log.warning(
        "AUTH DEV BYPASS ACTIVE: header %s skips JWT verification (APP_ENV=dev). "
        "Never run like this in production.",
        DEV_HEADER,
    )


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


class EmailNotVerified(HTTPException):
    """403 for a valid token whose email is not verified yet (see EMAIL_VERIFIED_CLAIM)."""

    def __init__(self) -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=EMAIL_NOT_VERIFIED)


@lru_cache(maxsize=4)
def _jwks_client(domain: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(
        f"https://{domain}/.well-known/jwks.json",
        cache_keys=True,
        lifespan=3600,
    )


def verify_token(token: str) -> dict:
    """Verify an Auth0 access token and return its claims. Raises 401."""
    domain = settings.AUTH0_DOMAIN
    audience = settings.AUTH0_AUDIENCE
    if not domain or not audience:
        log.error("AUTH0_DOMAIN or AUTH0_AUDIENCE is not configured")
        raise _unauthorized("auth is not configured on the server")

    try:
        signing_key = _jwks_client(domain).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=f"https://{domain}/",
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized("token expired")
    except jwt.PyJWKClientError as exc:
        log.warning("JWKS lookup failed: %s", exc)
        raise _unauthorized("invalid token")
    except jwt.InvalidTokenError:
        raise _unauthorized("invalid token")


def verified_claims(token: str) -> dict:
    """verify_token, then require a verified email. Raises 401, or 403 EmailNotVerified.

    A token without the claim (an old token, or an Action that does not set it) counts as
    not verified: fail closed.
    """
    claims = verify_token(token)
    if claims.get(EMAIL_VERIFIED_CLAIM) is not True:
        raise EmailNotVerified()
    return claims


def upsert_user(conn, auth0_sub: str, email: str | None, display_name: str | None) -> dict:
    """Insert or update the user by auth0_sub and return the row as a dict.

    is_student is never set here: only a completed student verification sets it
    (routers/student.py), never a token claim. The returned is_student is false once
    that verification is over a year old.
    """
    row = conn.execute(
        f"""
        insert into users (auth0_sub, email, display_name)
        values (%s, %s, %s)
        on conflict (auth0_sub) do update
            set email = coalesce(excluded.email, users.email)
        returning id, auth0_sub, display_name, email, {active_sql("users")} as is_student, created_at
        """,
        (auth0_sub, email, display_name),
    ).fetchone()
    return dict(row)


def authenticate(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    dev_user: str | None = Depends(dev_user_scheme),
) -> dict:
    """FastAPI dependency: who the caller is, from the token or the dev header.

    Raises 401 (no or bad token) or 403 EmailNotVerified. Dev users count as verified.

    No database: returns the upsert_user arguments (auth0_sub, email, display_name). Endpoints that must not hold a connection for long (POST /lease/analyze)
    use this and upsert on a short connection of their own.
    """
    if dev_user is not None and dev_bypass_enabled():
        name = dev_user.strip()
        if not name or len(name) > DEV_NAME_MAX:
            raise _unauthorized(f"invalid {DEV_HEADER} header")
        return {"auth0_sub": f"dev|{name}", "email": None, "display_name": name}

    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise _unauthorized("missing bearer token")

    claims = verified_claims(creds.credentials)
    email = claims.get(EMAIL_CLAIM)
    return {
        "auth0_sub": claims["sub"],
        "email": email if isinstance(email, str) and email else None,
        "display_name": None,
    }


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    dev_user: str | None = Depends(dev_user_scheme),
    conn=Depends(get_conn),
) -> dict:
    """FastAPI dependency: the authenticated users row as a dict."""
    return upsert_user(conn, **authenticate(creds, dev_user))


def caller_access(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    dev_user: str | None = Depends(dev_user_scheme),
    dev_roles: str | None = Depends(dev_roles_scheme),
) -> dict:
    """FastAPI dependency: the caller's roles and whether the login used MFA.

    Raises 401 (no or bad token) or 403 EmailNotVerified.

    Returns {"roles": set[str], "mfa": bool}, read from the access token. Kept apart from
    authenticate(), whose result is passed straight to upsert_user. No database.
    """
    if dev_user is not None and dev_bypass_enabled():
        if not dev_user.strip() or len(dev_user.strip()) > DEV_NAME_MAX:
            raise _unauthorized(f"invalid {DEV_HEADER} header")
        roles = {r.strip() for r in (dev_roles or "").split(",") if r.strip()}
        return {"roles": roles, "mfa": True}

    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise _unauthorized("missing bearer token")

    claims = verified_claims(creds.credentials)
    roles = claims.get(ROLES_CLAIM)
    return {
        "roles": {r for r in roles if isinstance(r, str)} if isinstance(roles, list) else set(),
        "mfa": claims.get(MFA_CLAIM) is True,
    }


def effective_roles(access: dict) -> set[str]:
    """The roles that count for a caller_access result: admin only with an MFA login."""
    roles = set(access["roles"])
    if not access["mfa"]:
        roles.discard(ADMIN_ROLE)
    return roles


def require_role(*allowed: str):
    """Dependency factory: the caller must hold one of `allowed`, else 403.

    Use as `dependencies=[Depends(require_role("admin"))]` or as a parameter to get the
    access dict. An admin account must also have signed in with MFA.
    """

    def dependency(access: dict = Depends(caller_access)) -> dict:
        if not access["roles"].intersection(allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="you do not have permission to do this",
            )
        if ADMIN_ROLE in access["roles"] and not access["mfa"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="admin accounts must sign in with multi-factor authentication",
            )
        return access

    return dependency
