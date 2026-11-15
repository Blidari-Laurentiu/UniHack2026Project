"""Feature B (Person B): interests and the user's matching profile."""

from typing import get_args
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile

from auth import current_user
from db import get_conn
from schemas.common import Slot
from schemas.events import Interest, ProfileIn, ProfileOut
from services import avatars
from services.avatars import AvatarError, avatar_path
from services.student import active_sql

router = APIRouter(prefix="/profile", tags=["profile"])

SLOT_ORDER = list(get_args(Slot))


def load_profile(conn, user_id) -> ProfileOut:
    user = conn.execute(
        f"""
        select u.display_name, {active_sql("u")} as is_student, a.updated_at as avatar_updated_at
        from users u left join user_avatars a on a.user_id = u.id
        where u.id = %s
        """,
        (user_id,),
    ).fetchone()
    interests = conn.execute(
        """
        select i.id, i.slug, i.label
        from user_interests ui join interests i on i.id = ui.interest_id
        where ui.user_id = %s
        order by i.label
        """,
        (user_id,),
    ).fetchall()
    slots = {
        row["slot"]
        for row in conn.execute("select slot from user_availability where user_id = %s", (user_id,))
    }
    return ProfileOut(
        user_id=user_id,
        display_name=user["display_name"],
        is_student=bool(user["is_student"]),
        interests=interests,
        availability=[s for s in SLOT_ORDER if s in slots],
        avatar_url=avatar_path(user_id, user["avatar_updated_at"]),
    )


@router.get("/interests", response_model=list[Interest])
def list_interests(conn=Depends(get_conn)):
    return conn.execute("select id, slug, label from interests order by label").fetchall()


@router.get("", response_model=ProfileOut)
def get_profile(user: dict = Depends(current_user), conn=Depends(get_conn)):
    return load_profile(conn, user["id"])


@router.put("", response_model=ProfileOut)
def save_profile(body: ProfileIn, user: dict = Depends(current_user), conn=Depends(get_conn)):
    display_name = body.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="display_name must not be empty")

    slugs = list(dict.fromkeys(body.interest_slugs))
    found = conn.execute("select id, slug from interests where slug = any(%s)", (slugs,)).fetchall()
    unknown = sorted(set(slugs) - {row["slug"] for row in found})
    if unknown:
        raise HTTPException(status_code=422, detail=f"unknown interest: {', '.join(unknown)}")

    user_id = user["id"]
    conn.execute("update users set display_name = %s where id = %s", (display_name, user_id))
    conn.execute("delete from user_interests where user_id = %s", (user_id,))
    conn.execute("delete from user_availability where user_id = %s", (user_id,))
    with conn.cursor() as cur:
        if found:
            cur.executemany(
                "insert into user_interests (user_id, interest_id) values (%s, %s)",
                [(user_id, row["id"]) for row in found],
            )
        if body.availability:
            cur.executemany(
                "insert into user_availability (user_id, slot) values (%s, %s)",
                [(user_id, slot) for slot in dict.fromkeys(body.availability)],
            )

    profile = load_profile(conn, user_id)
    conn.commit()  # before the response, so the next request already sees the change
    return profile


# --- profile picture ---


@router.put("/avatar", response_model=ProfileOut)
def upload_avatar(file: UploadFile, user: dict = Depends(current_user), conn=Depends(get_conn)):
    """Set or replace the caller's profile picture: one multipart field, `file`."""
    data = file.file.read(avatars.MAX_BYTES + 1)  # one byte past the limit shows it is too big
    try:
        content_type = avatars.content_type_of(data)
    except AvatarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    # clock_timestamp(), not now(): two uploads must never share a `v` in the picture's URL.
    conn.execute(
        """
        insert into user_avatars (user_id, content_type, image, updated_at)
        values (%s, %s, %s, clock_timestamp())
        on conflict (user_id) do update
            set content_type = excluded.content_type,
                image = excluded.image,
                updated_at = excluded.updated_at
        """,
        (user["id"], content_type, data),
    )
    profile = load_profile(conn, user["id"])
    conn.commit()
    return profile


@router.delete("/avatar", response_model=ProfileOut)
def delete_avatar(user: dict = Depends(current_user), conn=Depends(get_conn)):
    """Remove the caller's picture; they show as the mascot again. Fine when there is none."""
    conn.execute("delete from user_avatars where user_id = %s", (user["id"],))
    profile = load_profile(conn, user["id"])
    conn.commit()
    return profile


@router.get("/avatar/{user_id}")
def get_avatar(user_id: UUID, conn=Depends(get_conn)):
    """The picture itself. Public, because an <img> tag cannot send a token."""
    row = conn.execute(
        "select content_type, image from user_avatars where user_id = %s", (user_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=avatars.NO_PICTURE)
    return Response(
        content=bytes(row["image"]),
        media_type=row["content_type"],
        headers={
            # The URL carries ?v=<upload time>, so a new picture always has a new URL.
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )
