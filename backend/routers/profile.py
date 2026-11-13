"""Feature B (Person B): interests and the user's matching profile."""

from typing import get_args

from fastapi import APIRouter, Depends, HTTPException

from auth import current_user
from db import get_conn
from schemas.common import Slot
from schemas.events import Interest, ProfileIn, ProfileOut

router = APIRouter(prefix="/profile", tags=["profile"])

SLOT_ORDER = list(get_args(Slot))


def load_profile(conn, user_id) -> ProfileOut:
    user = conn.execute(
        "select display_name, is_student from users where id = %s", (user_id,)
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
        display_name=user["display_name"],
        is_student=bool(user["is_student"]),
        interests=interests,
        availability=[s for s in SLOT_ORDER if s in slots],
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
