"""Feature B (Person B): events, signups and groups."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials

from auth import bearer_scheme, current_user, dev_bypass_enabled, dev_user_scheme
from db import get_conn
from schemas.events import Event, Group, GroupMember, Interest, MatchResult, SignupOut
from services.matching import form_groups

router = APIRouter(prefix="/events", tags=["events"])

MIN_GROUP_SIZE = 3
MEET_BEFORE = timedelta(minutes=30)
MEET_NOTE = "Meet at the entrance 30 minutes before."


def optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    dev_user: str | None = Depends(dev_user_scheme),
    conn=Depends(get_conn),
) -> dict | None:
    """The logged-in user, or None for an anonymous caller. A bad token is still a 401."""
    if creds is None and not (dev_user is not None and dev_bypass_enabled()):
        return None
    return current_user(creds, dev_user, conn)


def _require_event(conn, event_id: UUID, lock: bool = False) -> dict:
    """The event row, or 404. lock=True serialises joins, leaves and matches per event."""
    row = conn.execute(
        "select id, starts_at from events where id = %s" + (" for update" if lock else ""),
        (event_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="event not found")
    return row


def _require_upcoming(event: dict) -> None:
    """Joining or matching makes no sense once the event has started: 409."""
    if event["starts_at"] <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="this event has already started")


def _load_groups(conn, group_ids: list[UUID]) -> list[Group]:
    """Groups with their members, in the order of group_ids."""
    if not group_ids:
        return []
    groups = {
        row["id"]: row
        for row in conn.execute(
            "select id, event_id, meet_at, note, why_you_match from event_groups where id = any(%s)",
            (group_ids,),
        )
    }
    members: dict[UUID, list[GroupMember]] = {gid: [] for gid in groups}
    for row in conn.execute(
        """
        select gm.group_id, u.id as user_id, u.display_name, u.is_student
        from group_members gm join users u on u.id = gm.user_id
        where gm.group_id = any(%s)
        order by u.display_name nulls last, u.id
        """,
        (group_ids,),
    ):
        members[row["group_id"]].append(
            GroupMember(
                user_id=row["user_id"],
                display_name=row["display_name"],
                is_student=bool(row["is_student"]),
            )
        )
    return [
        Group(
            id=gid,
            event_id=groups[gid]["event_id"],
            meet_at=groups[gid]["meet_at"],
            note=groups[gid]["note"],
            members=members[gid],
            why_you_match=groups[gid]["why_you_match"] or "",
        )
        for gid in group_ids
        if gid in groups
    ]


@router.get("", response_model=list[Event])
def list_events(
    interest: str | None = Query(None, description="interest slug"),
    from_: datetime | None = Query(None, alias="from", description="default: now"),
    to: datetime | None = Query(None),
    user: dict | None = Depends(optional_user),
    conn=Depends(get_conn),
):
    where = ["e.starts_at >= coalesce(%(from)s::timestamptz, now())"]
    if to is not None:
        where.append("e.starts_at <= %(to)s")
    if interest:
        where.append("i.slug = %(interest)s")

    rows = conn.execute(
        f"""
        select e.id, e.title, e.venue, e.starts_at, e.slot, e.description,
               i.id as interest_id, i.slug as interest_slug, i.label as interest_label,
               (select count(*) from event_signups s
                 where s.event_id = e.id and s.status in ('waiting', 'grouped')) as signup_count,
               (select s.status from event_signups s
                 where s.event_id = e.id and s.user_id = %(user_id)s::uuid) as my_status
        from events e left join interests i on i.id = e.interest_id
        where {" and ".join(where)}
        order by e.starts_at, e.title
        """,
        {"from": from_, "to": to, "interest": interest, "user_id": user["id"] if user else None},
    ).fetchall()

    return [
        Event(
            id=r["id"],
            title=r["title"],
            venue=r["venue"],
            starts_at=r["starts_at"],
            slot=r["slot"],
            interest=(
                Interest(id=r["interest_id"], slug=r["interest_slug"], label=r["interest_label"])
                if r["interest_id"]
                else None
            ),
            description=r["description"],
            signup_count=r["signup_count"],
            my_status=r["my_status"],
        )
        for r in rows
    ]


@router.post("/{event_id}/join", response_model=SignupOut)
def join_event(event_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    _require_upcoming(_require_event(conn, event_id))
    # Joining again after leaving puts you at the back of the waiting list.
    row = conn.execute(
        """
        insert into event_signups (event_id, user_id, status) values (%s, %s, 'waiting')
        on conflict (event_id, user_id) do update set
            status = case when event_signups.status = 'left' then 'waiting'
                          else event_signups.status end,
            created_at = case when event_signups.status = 'left' then now()
                              else event_signups.created_at end
        returning status
        """,
        (event_id, user["id"]),
    ).fetchone()
    conn.commit()
    return SignupOut(event_id=event_id, status=row["status"])


@router.post("/{event_id}/leave", response_model=SignupOut)
def leave_event(event_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    _require_event(conn, event_id, lock=True)
    signup = conn.execute(
        "select status from event_signups where event_id = %s and user_id = %s",
        (event_id, user["id"]),
    ).fetchone()
    if signup is None:
        raise HTTPException(status_code=404, detail="you have not joined this event")

    if signup["status"] == "grouped":
        left = conn.execute(
            """
            delete from group_members gm using event_groups g
            where gm.group_id = g.id and g.event_id = %s and gm.user_id = %s
            returning gm.group_id
            """,
            (event_id, user["id"]),
        ).fetchall()
        for row in left:
            rest = [
                r["user_id"]
                for r in conn.execute(
                    "select user_id from group_members where group_id = %s", (row["group_id"],)
                )
            ]
            if len(rest) < MIN_GROUP_SIZE:
                # Too small to go on: the others go back to the front of the waiting list.
                conn.execute(
                    "update event_signups set status = 'waiting' "
                    "where event_id = %s and user_id = any(%s)",
                    (event_id, rest),
                )
                conn.execute("delete from event_groups where id = %s", (row["group_id"],))

    conn.execute(
        "update event_signups set status = 'left' where event_id = %s and user_id = %s",
        (event_id, user["id"]),
    )
    conn.commit()
    return SignupOut(event_id=event_id, status="left")


@router.post("/{event_id}/match", response_model=MatchResult)
def run_match(event_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    event = _require_event(conn, event_id, lock=True)
    _require_upcoming(event)
    # Only people on this event can trigger its matching, not any logged-in user.
    mine = conn.execute(
        "select status from event_signups where event_id = %s and user_id = %s",
        (event_id, user["id"]),
    ).fetchone()
    if mine is None or mine["status"] == "left":
        raise HTTPException(status_code=403, detail="join this event before matching")

    waiting = conn.execute(
        """
        select u.id, s.created_at as joined_at,
               coalesce((select array_agg(i.slug order by i.slug)
                         from user_interests ui join interests i on i.id = ui.interest_id
                         where ui.user_id = u.id), '{}') as interests,
               coalesce((select array_agg(a.slot order by a.slot)
                         from user_availability a where a.user_id = u.id), '{}') as availability
        from event_signups s join users u on u.id = s.user_id
        where s.event_id = %s and s.status = 'waiting'
        order by s.created_at, u.id
        """,
        (event_id,),
    ).fetchall()
    labels = {row["slug"]: row["label"] for row in conn.execute("select slug, label from interests")}

    group_ids = []
    placed = 0
    for formed in form_groups(waiting, labels=labels):
        member_ids = [m["id"] for m in formed["members"]]
        group_id = conn.execute(
            "insert into event_groups (event_id, meet_at, note, why_you_match) "
            "values (%s, %s, %s, %s) returning id",
            (event_id, event["starts_at"] - MEET_BEFORE, MEET_NOTE, formed["why_you_match"]),
        ).fetchone()["id"]
        with conn.cursor() as cur:
            cur.executemany(
                "insert into group_members (group_id, user_id) values (%s, %s)",
                [(group_id, member_id) for member_id in member_ids],
            )
        conn.execute(
            "update event_signups set status = 'grouped' where event_id = %s and user_id = any(%s)",
            (event_id, member_ids),
        )
        group_ids.append(group_id)
        placed += len(member_ids)

    result = MatchResult(
        event_id=event_id,
        groups=_load_groups(conn, group_ids),
        unmatched_count=len(waiting) - placed,
    )
    conn.commit()
    return result


@router.get("/{event_id}/my-group", response_model=Group)
def get_my_group(event_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    _require_event(conn, event_id)
    row = conn.execute(
        """
        select g.id
        from event_groups g join group_members gm on gm.group_id = g.id
        where g.event_id = %s and gm.user_id = %s
        order by g.created_at desc
        limit 1
        """,
        (event_id, user["id"]),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="not in a group yet")
    return _load_groups(conn, [row["id"]])[0]
