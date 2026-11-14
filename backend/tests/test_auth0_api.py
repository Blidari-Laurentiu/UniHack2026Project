"""services/auth0_api.py: the requests it makes to Auth0. No network: urlopen is a fake."""

import io
import json
import urllib.error

import pytest

from config import settings
from services import auth0_api

DOMAIN = "tenant.example.auth0.com"
API = f"https://{DOMAIN}/api/v2"
SUB = "google-oauth2|1082"
SUB_PATH = "google-oauth2%7C1082"


class Queue(list):
    """Answers for successive calls to one route."""


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture
def auth0(monkeypatch):
    """Management API configured; answers come from .routes ({(method, url): body or error})."""
    monkeypatch.setattr(settings, "AUTH0_DOMAIN", DOMAIN)
    monkeypatch.setattr(settings, "AUTH0_MGMT_CLIENT_ID", "m2m-id")
    monkeypatch.setattr(settings, "AUTH0_MGMT_CLIENT_SECRET", "m2m-secret")
    auth0_api._token.update(value=None, expires_at=0.0)

    class Fake:
        calls: list = []
        routes: dict = {}
        tokens = 0

        def urlopen(self, request, timeout):
            method, url = request.get_method(), request.full_url
            body = json.loads(request.data) if request.data else None
            self.calls.append((method, url, body, request.get_header("Authorization")))
            if url.endswith("/oauth/token"):
                self.tokens += 1
                return Response(json.dumps({"access_token": f"tok{self.tokens}", "expires_in": 86400}).encode())
            answer = self.routes.get((method, url), b"")
            if isinstance(answer, Queue):
                answer = answer.pop(0)
            if isinstance(answer, Exception):
                raise answer
            return Response(answer if isinstance(answer, bytes) else json.dumps(answer).encode())

        def api_calls(self):
            return [(m, u) for m, u, _, _ in self.calls if not u.endswith("/oauth/token")]

    fake = Fake()
    fake.calls, fake.routes = [], {}
    monkeypatch.setattr(auth0_api.urllib.request, "urlopen", fake.urlopen)
    yield fake
    auth0_api._token.update(value=None, expires_at=0.0)


def http_error(code, body):
    return urllib.error.HTTPError("u", code, "x", {}, io.BytesIO(json.dumps(body).encode()))


METHODS = [
    {"id": "password|abc", "type": "password", "created_at": "2026-01-01T00:00:00Z"},
    {"id": "totp|dev_1", "type": "totp", "confirmed": True, "created_at": "2026-01-01T00:00:00Z"},
    {"id": "recovery-code|dev_2", "type": "recovery-code", "confirmed": True, "created_at": "2026-01-01T00:00:00Z"},
]
LIST = ("GET", f"{API}/users/{SUB_PATH}/authentication-methods?per_page=100")


def test_token_request_and_cache(auth0):
    auth0.routes[LIST] = []
    assert auth0_api.has_totp(SUB) is False
    assert auth0_api.has_totp(SUB) is False
    method, url, body, _ = auth0.calls[0]
    assert (method, url) == ("POST", f"https://{DOMAIN}/oauth/token")
    assert body == {
        "grant_type": "client_credentials",
        "client_id": "m2m-id",
        "client_secret": "m2m-secret",
        "audience": f"https://{DOMAIN}/api/v2/",
    }
    assert auth0.tokens == 1  # the second call reused the token
    assert [c[3] for c in auth0.calls[1:]] == ["Bearer tok1", "Bearer tok1"]


@pytest.mark.parametrize(
    "methods,expected",
    [
        (METHODS, True),
        ([METHODS[0]], False),  # a password is not a second factor
        ([{"id": "totp|x", "type": "totp", "confirmed": False}], False),  # QR shown, never finished
        ([{"id": "totp|x", "type": "totp"}], True),
        ({"authenticators": METHODS, "total": 3}, True),  # the paged shape
    ],
)
def test_has_totp(auth0, methods, expected):
    auth0.routes[LIST] = methods
    assert auth0_api.has_totp(SUB) is expected


def test_remove_totp_deletes_only_the_second_factor(auth0):
    auth0.routes[LIST] = METHODS
    assert auth0_api.remove_totp(SUB) == 2
    assert auth0.api_calls() == [
        LIST,
        ("DELETE", f"{API}/users/{SUB_PATH}/authentication-methods/totp%7Cdev_1"),
        ("DELETE", f"{API}/users/{SUB_PATH}/authentication-methods/recovery-code%7Cdev_2"),
    ]


def test_delete_user_encodes_the_id(auth0):
    auth0_api.delete_user("auth0|65f1/x")
    assert auth0.api_calls() == [("DELETE", f"{API}/users/auth0%7C65f1%2Fx")]


def test_expired_token_is_renewed_once(auth0):
    auth0.routes[LIST] = Queue([http_error(401, {"message": "Expired token"}), METHODS])
    assert auth0_api.has_totp(SUB) is True
    assert auth0.tokens == 2
    assert [c[3] for c in auth0.calls if c[0] == "GET"] == ["Bearer tok1", "Bearer tok2"]


def test_error_carries_auth0s_reason_but_no_secret(auth0):
    auth0.routes[LIST] = http_error(403, {"message": "Insufficient scope, expected any of: read:authentication_methods"})
    with pytest.raises(auth0_api.Auth0Error) as info:
        auth0_api.has_totp(SUB)
    assert info.value.status == 403
    assert "read:authentication_methods" in str(info.value)
    assert "m2m-secret" not in str(info.value) and "tok1" not in str(info.value)


def test_network_failure_is_an_auth0_error(auth0):
    auth0.routes[LIST] = urllib.error.URLError("timed out")
    with pytest.raises(auth0_api.Auth0Error, match="could not be reached"):
        auth0_api.has_totp(SUB)


def test_not_configured(auth0, monkeypatch):
    monkeypatch.setattr(settings, "AUTH0_MGMT_CLIENT_SECRET", "")
    assert auth0_api.configured() is False
    with pytest.raises(auth0_api.Auth0NotConfigured):
        auth0_api.delete_user(SUB)
    assert auth0.calls == []


def test_password_reset_needs_no_management_token(auth0, monkeypatch):
    monkeypatch.setattr(settings, "AUTH0_MGMT_CLIENT_ID", "")  # works without the M2M application
    url = f"https://{DOMAIN}/dbconnections/change_password"
    auth0.routes[("POST", url)] = b"We've just sent you an email to reset your password."
    auth0_api.send_password_reset("ana@example.com")
    assert auth0.calls == [
        ("POST", url, {"email": "ana@example.com", "connection": "Username-Password-Authentication"}, None)
    ]
