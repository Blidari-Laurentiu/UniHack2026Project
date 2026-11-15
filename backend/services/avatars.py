"""Feature B (Person B): profile pictures.

The browser crops and resizes a picture to 256 px before upload, so the stored file is small
and lives in Postgres (user_avatars). A user without one gets the mascot, which the frontend
draws from the user id; nothing is stored for it.
"""

from datetime import datetime
from uuid import UUID

MAX_BYTES = 512 * 1024  # same limit as the check constraint in db/schema/25_avatars.sql

EMPTY = "the file is empty"
TOO_BIG = "the picture is too large (512 KB at most)"
NOT_A_PICTURE = "use a JPEG, PNG or WebP picture"
NO_PICTURE = "no profile picture"


class AvatarError(Exception):
    """A rejected upload. status_code is the HTTP status, str(exc) the detail."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code


def content_type_of(data: bytes) -> str:
    """The picture type, read from the first bytes of the file. Raises AvatarError.

    The upload's own Content-Type header and file name are never trusted: the type we store
    is the one we serve, so an HTML or SVG file can never be served as a page.
    """
    if not data:
        raise AvatarError(422, EMPTY)
    if len(data) > MAX_BYTES:
        raise AvatarError(413, TOO_BIG)
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise AvatarError(415, NOT_A_PICTURE)


def avatar_path(user_id: UUID, updated_at: datetime | None) -> str | None:
    """Path of GET /profile/avatar/{user_id}, or None for a user without a picture.

    `v` changes with every upload, so the picture itself can be cached for a year.
    """
    if updated_at is None:
        return None
    return f"/profile/avatar/{user_id}?v={int(updated_at.timestamp() * 1000)}"
