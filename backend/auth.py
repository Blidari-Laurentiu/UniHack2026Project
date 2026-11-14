"""Auth0 access-token verification and the current_user dependency.

Tokens are RS256 JWTs signed by Auth0; signing keys come from the tenant's
JWKS endpoint through one cached PyJWKClient.

Dev bypass: when APP_ENV == "dev" (and only then), the header
`X-Dev-User: <name>` skips JWT verification and acts as user "dev|<name>".
"""

import logging
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from config import settings
from db import get_conn

log = logging.getLogger("uvicorn.error")

EMAIL_CLAIM = "https://newcomer-hub/email"
STUDENT_CLAIM = "https://newcomer-hub/student"
DEV_HEADER = "X-Dev-User"
DEV_NAME_MAX = 64

bearer_scheme = HTTPBearer(auto_error=False)
dev_user_scheme = APIKeyHeader(name=DEV_HEADER, auto_error=False)


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


def upsert_user(
    conn, auth0_sub: str, email: str | None, is_student: bool, display_name: str | None
) -> dict:
    """Insert or update the user by auth0_sub and return the row as a dict."""
    row = conn.execute(
        """
        insert into users (auth0_sub, email, is_student, display_name)
        values (%s, %s, %s, %s)
        on conflict (auth0_sub) do update
            set email = coalesce(excluded.email, users.email),
                is_student = excluded.is_student
        returning id, auth0_sub, display_name, email, is_student, created_at
        """,
        (auth0_sub, email, is_student, display_name),
    ).fetchone()
    return dict(row)


def authenticate(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    dev_user: str | None = Depends(dev_user_scheme),
) -> dict:
    """FastAPI dependency: who the caller is, from the token or the dev header. Raises 401.

    No database: returns the upsert_user arguments (auth0_sub, email, is_student,
    display_name). Endpoints that must not hold a connection for long (POST /lease/analyze)
    use this and upsert on a short connection of their own.
    """
    if dev_user is not None and dev_bypass_enabled():
        name = dev_user.strip()
        if not name or len(name) > DEV_NAME_MAX:
            raise _unauthorized(f"invalid {DEV_HEADER} header")
        return {"auth0_sub": f"dev|{name}", "email": None, "is_student": False, "display_name": name}

    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise _unauthorized("missing bearer token")

    claims = verify_token(creds.credentials)
    email = claims.get(EMAIL_CLAIM)
    return {
        "auth0_sub": claims["sub"],
        "email": email if isinstance(email, str) and email else None,
        "is_student": claims.get(STUDENT_CLAIM) is True,
        "display_name": None,
    }


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    dev_user: str | None = Depends(dev_user_scheme),
    conn=Depends(get_conn),
) -> dict:
    """FastAPI dependency: the authenticated users row as a dict."""
    return upsert_user(conn, **authenticate(creds, dev_user))
