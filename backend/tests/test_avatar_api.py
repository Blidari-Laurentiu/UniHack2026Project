"""Profile pictures: which uploads are accepted, and who may upload (no database).

Storing, serving and removing a picture are tested against the real schema in
test_events_api.py.
"""

from datetime import datetime, timezone
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from auth import current_user
from db import get_conn
from main import app
from services import avatars
from services.avatars import AvatarError, avatar_path, content_type_of

USER_ID = UUID("c1000000-0000-4000-8000-000000000001")
FAKE_USER = {
    "id": USER_ID,
    "auth0_sub": "dev|mei",
    "display_name": "Mei",
    "email": None,
    "is_student": False,
    "created_at": datetime(2026, 11, 13, tzinfo=timezone.utc),
}

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x40\x00\x00\x00WEBPVP8 " + b"\x00" * 64


@pytest.mark.parametrize(
    "data,expected", [(PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp")]
)
def test_picture_type_comes_from_the_bytes(data, expected):
    assert content_type_of(data) == expected


@pytest.mark.parametrize(
    "data,status,detail",
    [
        (b"", 422, avatars.EMPTY),
        (PNG + b"\x00" * avatars.MAX_BYTES, 413, avatars.TOO_BIG),
        (b"GIF89a" + b"\x00" * 64, 415, avatars.NOT_A_PICTURE),
        (b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 415, avatars.NOT_A_PICTURE),
        (b"<!doctype html><script>alert(1)</script>", 415, avatars.NOT_A_PICTURE),
        (b"RIFF\x40\x00\x00\x00WAVEfmt " + b"\x00" * 64, 415, avatars.NOT_A_PICTURE),
        (b"%PDF-1.7\n", 415, avatars.NOT_A_PICTURE),
    ],
)
def test_other_files_are_refused(data, status, detail):
    with pytest.raises(AvatarError) as caught:
        content_type_of(data)
    assert caught.value.status_code == status
    assert str(caught.value) == detail


def test_picture_at_the_size_limit_is_accepted():
    assert content_type_of(PNG + b"\x00" * (avatars.MAX_BYTES - len(PNG))) == "image/png"


def test_picture_url_changes_with_every_upload():
    first = datetime(2026, 11, 15, 10, 0, 0, 1000, tzinfo=timezone.utc)
    second = datetime(2026, 11, 15, 10, 0, 0, 2000, tzinfo=timezone.utc)  # one millisecond later
    assert avatar_path(USER_ID, first) == f"/profile/avatar/{USER_ID}?v=1794736800001"
    assert avatar_path(USER_ID, second) != avatar_path(USER_ID, first)
    assert avatar_path(USER_ID, None) is None


# --- the endpoints, without a database ---


@pytest.fixture
def anon_client():
    app.dependency_overrides[get_conn] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    # get_conn gives None: a refused upload must be turned away before any query runs.
    app.dependency_overrides[current_user] = lambda: FAKE_USER
    app.dependency_overrides[get_conn] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_changing_the_picture_needs_auth(anon_client):
    r = anon_client.put("/profile/avatar", files={"file": ("me.png", PNG, "image/png")})
    assert r.status_code == 401
    assert "detail" in r.json()
    assert anon_client.delete("/profile/avatar").status_code == 401


@pytest.mark.parametrize(
    "data,status,detail",
    [
        (b"", 422, avatars.EMPTY),
        (PNG + b"\x00" * avatars.MAX_BYTES, 413, avatars.TOO_BIG),
        (b"<!doctype html><script>alert(1)</script>", 415, avatars.NOT_A_PICTURE),
    ],
)
def test_refused_upload_is_a_json_error(client, data, status, detail):
    # The upload claims to be a PNG; only the bytes count.
    r = client.put("/profile/avatar", files={"file": ("me.png", data, "image/png")})
    assert r.status_code == status
    assert r.json() == {"detail": detail}


def test_upload_without_a_file_is_422(client):
    assert client.put("/profile/avatar").status_code == 422
