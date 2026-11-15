"""Feature B (Person B): the review queue for moderators and admins.

The queue holds upcoming events that are 'pending' (new from someone who is not trusted yet,
or sent back by reports) and active events with at least one open report. Approving puts the
event on the list and dismisses its open reports; rejecting takes it off for good.
An admin without MFA gets 403 (auth.require_role).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from auth import ADMIN_ROLE, MODERATOR_ROLE, current_user, require_role
from db import get_conn
from schemas.events import (
    EventCreator,
    Interest,
    ModerationEvent,
    ModerationReport,
    ModerationResult,
)

router = APIRouter(
    prefix="/moderation",
    tags=["moderation"],
    dependencies=[Depends(require_role(MODERATOR_ROLE, ADMIN_ROLE))],
)

MAX_ROWS = 200


@router.get("/events", response_model=list[ModerationEvent])
def review_queue(conn=Depends(get_conn)):
    """Pending events first, then the most reported; at most MAX_ROWS."""
    rows = conn.execute(
        """
        select e.id, e.title, e.venue, e.starts_at, e.description, e.status, e.created_at,
               i.id as interest_id, i.slug as interest_slug, i.label as interest_label,
               u.id as creator_id, u.display_name as creator_name,
               (select count(*) from event_signups s
                 where s.event_id = e.id and s.status in ('waiting', 'grouped')) as signup_count,
               (select count(*) from reports r
                 where r.event_id = e.id and r.status = 'open') as open_reports
        from events e
             left join interests i on i.id = e.interest_id
             left join users u on u.id = e.created_by
        where e.starts_at >= now()
          and (e.status = 'pending'
               or (e.status = 'active' and exists (
                     select 1 from reports r where r.event_id = e.id and r.status = 'open')))
        order by (e.status = 'pending') desc, open_reports desc, e.starts_at, e.id
        limit %s
        """,
        (MAX_ROWS,),
    ).fetchall()

    reports: dict[UUID, list[ModerationReport]] = {r["id"]: [] for r in rows}
    for r in conn.execute(
        """
        select r.id, r.event_id, r.reason, r.created_at, u.display_name as reporter_name
        from reports r left join users u on u.id = r.reporter_id
        where r.event_id = any(%s::uuid[]) and r.status = 'open'
        order by r.created_at desc, r.id
        """,
        (list(reports),),
    ):
        reports[r["event_id"]].append(
            ModerationReport(
                id=r["id"],
                reason=r["reason"],
                created_at=r["created_at"],
                reporter_name=r["reporter_name"],
            )
        )

    return [
        ModerationEvent(
            id=r["id"],
            title=r["title"],
            venue=r["venue"],
            starts_at=r["starts_at"],
            interest=(
                Interest(id=r["interest_id"], slug=r["interest_slug"], label=r["interest_label"])
                if r["interest_id"]
                else None
            ),
            description=r["description"],
            status=r["status"],
            created_at=r["created_at"],
            created_by=(
                EventCreator(user_id=r["creator_id"], display_name=r["creator_name"])
                if r["creator_id"]
                else None
            ),
            signup_count=r["signup_count"],
            reports=reports[r["id"]],
        )
        for r in rows
    ]


def _decide(conn, event_id: UUID, moderator: dict, status: str, reports: str) -> ModerationResult:
    """Set the event's status and close its open reports as `reports`."""
    row = conn.execute(
        "update events set status = %s where id = %s returning id", (status, event_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="event not found")
    conn.execute(
        "update reports set status = %s, resolved_by = %s, resolved_at = now()"
        " where event_id = %s and status = 'open'",
        (reports, moderator["id"], event_id),
    )
    conn.commit()
    return ModerationResult(event_id=event_id, status=status)


@router.post("/events/{event_id}/approve", response_model=ModerationResult)
def approve_event(event_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    """Put the event on the public list and dismiss its open reports."""
    return _decide(conn, event_id, user, "active", "dismissed")


@router.post("/events/{event_id}/reject", response_model=ModerationResult)
def reject_event(event_id: UUID, user: dict = Depends(current_user), conn=Depends(get_conn)):
    """Take the event off the list for good; its open reports are marked actioned."""
    return _decide(conn, event_id, user, "rejected", "actioned")
