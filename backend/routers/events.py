"""Feature B (Person B): events, signups and groups.

Anyone logged in can create an event (POST /events). Trusted creators (verified students,
people who already went out with a group, and the roles creator, moderator and admin) are
published at once; everyone else waits for a moderator (routers/moderation.py). An event with
more than REPORTS_BEFORE_REVIEW open reports goes back to 'pending' and off the list.
An upcoming event can be deleted by its creator, a moderator or an admin (DELETE /events/{id}).
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials

from auth import (
    ADMIN_ROLE,
    CREATOR_ROLE,
    MODERATOR_ROLE,
    EmailNotVerified,
    bearer_scheme,
    caller_access,
    current_user,
    dev_bypass_enabled,
    dev_user_scheme,
    effective_roles,
)
from config import settings
from db import get_conn
from schemas.events import (
    Event,
    EventIn,
    Group,
    GroupMember,
    Interest,
    MatchResult,
    ReportIn,
    ReportOut,
    SignupOut,
)
from services.avatars import avatar_path
from services.matching import form_groups
from services.student import active_sql

router = APIRouter(prefix="/events", tags=["events"])

MIN_GROUP_SIZE = 3
MEET_BEFORE = timedelta(minutes=30)
MEET_NOTE = "Meet at the entrance 30 minutes before."

LOCAL_TZ = ZoneInfo("Europe/Bucharest")  # slots are on Timișoara's wall clock
MAX_AHEAD = timedelta(days=365)
STAFF_ROLES = {CREATOR_ROLE, MODERATOR_ROLE, ADMIN_ROLE}  # no daily limit, no review
REMOVER_ROLES = {MODERATOR_ROLE, ADMIN_ROLE}  # can remove any event; a creator only their own
# An active event with more open reports than this goes to 'pending' until a moderator looks.
REPORTS_BEFORE_REVIEW = 10
NOT_OPEN = "this event is not open right now"


def optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    dev_user: str | None = Depends(dev_user_scheme),
    conn=Depends(get_conn),
) -> dict | None:
    """The logged-in user, or None for an anonymous caller. A bad token is still a 401.

    A user whose email is not verified yet browses the public list like an anonymous caller.
    """
    if creds is None and not (dev_user is not None and dev_bypass_enabled()):
        return None
    try:
        return current_user(creds, dev_user, conn)
    except EmailNotVerified:
        return None


def _require_event(conn, event_id: UUID, lock: bool = False) -> dict:
    """The event row, or 404. lock=True serialises joins, leaves and matches per event."""
    row = conn.execute(
        "select id, starts_at, status, created_by from events where id = %s"
        + (" for update" if lock else ""),
        (event_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="event not found")
    return row


def _require_upcoming(event: dict) -> None:
    """Joining or matching makes no sense once the event has started: 409."""
    if event["starts_at"] <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="this event has already started")


def _require_open(event: dict) -> dict:
    """Joining, matching and reporting need an event that is on the list: 409 otherwise."""
    if event["status"] != "active":
        raise HTTPException(status_code=409, detail=NOT_OPEN)
    return event


def slot_for(starts_at: datetime) -> str:
    """The availability slot of a start time (same rule as db/seed_events.py)."""
    local = starts_at.astimezone(LOCAL_TZ)
    part = "morning" if local.hour < 12 else "afternoon" if local.hour < 17 else "evening"
    if local.weekday() >= 5:
        return f"weekend_{part}"
    # There is no weekday afternoon slot.
    return "weekday_morning" if part == "morning" else "weekday_evening"


def _has_attended(conn, user_id: UUID) -> bool:
    """True when the user was in a group for an event that has already taken place."""
    return conn.execute(
        """
        select exists (
            select 1 from event_signups s join events e on e.id = s.event_id
            where s.user_id = %s and s.status = 'grouped' and e.starts_at < now()
        ) as attended
        """,
        (user_id,),
    ).fetchone()["attended"]


def _events(conn, where: list[str], params: dict, user: dict | None) -> list[Event]:
    """Events matching `where` (SQL on e and i), ordered by start time."""
    rows = conn.execute(
        f"""
        select e.id, e.title, e.venue, e.starts_at, e.slot, e.description, e.status,
               coalesce(e.created_by = %(user_id)s::uuid, false) as created_by_me,
               i.id as interest_id, i.slug as interest_slug, i.label as interest_label,
               (select count(*) from event_signups s
                 where s.event_id = e.id and s.status in ('waiting', 'grouped')) as signup_count,
               (select s.status from event_signups s
                 where s.event_id = e.id and s.user_id = %(user_id)s::uuid) as my_status
        from events e left join interests i on i.id = e.interest_id
        where {" and ".join(where)}
        order by e.starts_at, e.title
        """,
        {**params, "user_id": user["id"] if user else None},
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
            status=r["status"],
            created_by_me=r["created_by_me"],
        )
        for r in rows
    ]


def remove_from_groups(conn, user_id: UUID, event_id: UUID | None = None) -> None:
    """Take the user out of their groups: for one event, or for every event (account deletion).

    A group left with fewer than MIN_GROUP_SIZE members is dissolved and the others go back
    to the front of the waiting list. The caller holds the lock on the event rows.
    """
    left = conn.execute(
        """
        delete from group_members gm using event_groups g
        where gm.group_id = g.id and gm.user_id = %s and (%s::uuid is null or g.event_id = %s)
        returning gm.group_id, g.event_id
        """,
        (user_id, event_id, event_id),
    ).fetchall()
    for row in left:
        rest = [
            r["user_id"]
            for r in conn.execute(
                "select user_id from group_members where group_id = %s", (row["group_id"],)
            )
        ]
        if len(rest) < MIN_GROUP_SIZE:
            conn.execute(
                "update event_signups set status = 'waiting' "
                "where event_id = %s and user_id = any(%s)",
                (row["event_id"], rest),
            )
            conn.execute("delete from event_groups where id = %s", (row["group_id"],))


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
        f"""
        select gm.group_id, u.id as user_id, u.display_name, {active_sql("u")} as is_student,
               a.updated_at as avatar_updated_at
        from group_members gm join users u on u.id = gm.user_id
             left join user_avatars a on a.user_id = u.id
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
                avatar_url=avatar_path(row["user_id"], row["avatar_updated_at"]),
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
    mine: bool = Query(False, description="only the events the caller is going to"),
    user: dict | None = Depends(optional_user),
    conn=Depends(get_conn),
):
    if mine and user is None:
        raise HTTPException(status_code=401, detail="log in to see your events")
    # Events that are waiting for review or were removed show only to their creator.
    where = [
        "e.starts_at >= coalesce(%(from)s::timestamptz, now())",
        "(e.status = 'active' or e.created_by = %(user_id)s::uuid)",
    ]
    if mine:
        where.append(
            "exists (select 1 from event_signups s where s.event_id = e.id"
            " and s.user_id = %(user_id)s::uuid and s.status in ('waiting', 'grouped'))"
        )
    if to is not None:
        where.append("e.starts_at <= %(to)s")
    if interest:
        where.append("i.slug = %(interest)s")
    return _events(conn, where, {"from": from_, "to": to, "interest": interest}, user)


@router.post("", response_model=Event, status_code=201)
def create_event(
    body: EventIn,
    user: dict = Depends(current_user),
    access: dict = Depends(caller_access),
    conn=Depends(get_conn),
):
    now = datetime.now(timezone.utc)
    if body.starts_at <= now:
        raise HTTPException(status_code=422, detail="the event must start in the future")
    if body.starts_at > now + MAX_AHEAD:
        raise HTTPException(status_code=422, detail="the event must start within a year")

    interest_id = None
    if body.interest_slug:
        row = conn.execute(
            "select id from interests where slug = %s", (body.interest_slug,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=422, detail=f"unknown interest: {body.interest_slug}")
        interest_id = row["id"]

    # current_user holds the lock on this user's row, so two requests cannot both pass the count.
    staff = bool(effective_roles(access) & STAFF_ROLES)
    limit = settings.EVENT_CREATE_DAILY_LIMIT
    if not staff:
        recent = conn.execute(
            "select count(*) as n from events"
            " where created_by = %s and created_at > now() - interval '1 day'",
            (user["id"],),
        ).fetchone()["n"]
        if recent >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"you can create {limit} event{'' if limit == 1 else 's'} a day, try again tomorrow",
            )

    trusted = staff or user["is_student"] or _has_attended(conn, user["id"])
    event_id = conn.execute(
        """
        insert into events (title, venue, starts_at, slot, interest_id, description, created_by, status)
        values (%s, %s, %s, %s, %s, %s, %s, %s)
        returning id
        """,
        (
            body.title,
            body.venue,
            body.starts_at,
            slot_for(body.starts_at),
            interest_id,
            body.description or None,
            user["id"],
            "active" if trusted else "pending",
        ),
    ).fetchone()["id"]
    event = _events(conn, ["e.id = %(id)s"], {"id": event_id}, user)[0]
    conn.commit()
    return event


@router.post("/{event_id}/report", response_model=ReportOut, status_code=201)
def report_event(
    event_id: UUID,
    body: ReportIn,
    user: dict = Depends(current_user),
    conn=Depends(get_conn),
):
    # The lock makes the count below exact when several reports arrive together.
    event = _require_open(_require_event(conn, event_id, lock=True))
    if event["created_by"] == user["id"]:
        raise HTTPException(status_code=409, detail="you cannot report your own event")
    already = conn.execute(
        "select 1 from reports where event_id = %s and reporter_id = %s"
        " and reported_user_id is null and group_id is null",
        (event_id, user["id"]),
    ).fetchone()
    if already:
        raise HTTPException(status_code=409, detail="you have already reported this event")

    conn.execute(
        "insert into reports (reporter_id, event_id, reason) values (%s, %s, %s)",
        (user["id"], event_id, body.reason),
    )
    open_reports = conn.execute(
        "select count(*) as n from reports where event_id = %s and status = 'open'", (event_id,)
    ).fetchone()["n"]
    if open_reports > REPORTS_BEFORE_REVIEW:
        conn.execute("update events set status = 'pending' where id = %s", (event_id,))
    conn.commit()
    return ReportOut(event_id=event_id)


@router.delete("/{event_id}", status_code=204)
def remove_event(
    event_id: UUID,
    user: dict = Depends(current_user),
    access: dict = Depends(caller_access),
    conn=Depends(get_conn),
):
    """Delete an event for good: its creator, a moderator or an admin (with MFA).

    Signups and groups go with it (on delete cascade). An event that has started stays: its
    groups are what makes its people trusted creators (_has_attended).
    """
    event = _require_event(conn, event_id, lock=True)
    if event["created_by"] != user["id"] and not effective_roles(access) & REMOVER_ROLES:
        raise HTTPException(
            status_code=403, detail="only the creator or a moderator can remove this event"
        )
    _require_upcoming(event)
    # The reports outlive the event (event_id becomes null), so close the open ones first.
    conn.execute(
        "update reports set status = 'actioned', resolved_by = %s, resolved_at = now()"
        " where event_id = %s and status = 'open'",
        (user["id"], event_id),
    )
    conn.execute("delete from events where id = %s", (event_id,))
    conn.commit()


@router.post("/{event_id}/join", response_model=SignupOut)
def join_event(event_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    _require_upcoming(_require_open(_require_event(conn, event_id)))
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
        remove_from_groups(conn, user["id"], event_id)

    conn.execute(
        "update event_signups set status = 'left' where event_id = %s and user_id = %s",
        (event_id, user["id"]),
    )
    conn.commit()
    return SignupOut(event_id=event_id, status="left")


@router.post("/{event_id}/match", response_model=MatchResult)
def run_match(event_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    event = _require_open(_require_event(conn, event_id, lock=True))
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
