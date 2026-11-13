from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import current_user
from routers.profile import MOCK_INTERESTS
from schemas.events import Event, Group, GroupMember, MatchResult, SignupOut

router = APIRouter(prefix="/events", tags=["events"])

_I = {i.slug: i for i in MOCK_INTERESTS}
EET = timezone(timedelta(hours=2))

# MOCK - replace (select from events with signup counts)
MOCK_EVENTS = [
    Event(
        id=UUID("e1000000-0000-4000-8000-000000000001"),
        title="Board-game night",
        venue="Scârț Loc Lejer",
        starts_at=datetime(2026, 11, 18, 19, 0, tzinfo=EET),
        slot="weekday_evening",
        interest=_I["board_games"],
        description="Catan, Dixit and Codenames. Beginners welcome.",
        signup_count=9,
    ),
    Event(
        id=UUID("e1000000-0000-4000-8000-000000000002"),
        title="Hamlet (with English surtitles)",
        venue="Teatrul Național Timișoara",
        starts_at=datetime(2026, 11, 21, 19, 0, tzinfo=EET),
        slot="weekend_evening",
        interest=_I["theatre"],
        description="Classic production with English surtitles.",
        signup_count=6,
    ),
    Event(
        id=UUID("e1000000-0000-4000-8000-000000000003"),
        title="Poli Timișoara home match",
        venue="Stadionul Dan Păltinișanu",
        starts_at=datetime(2026, 11, 22, 15, 0, tzinfo=EET),
        slot="weekend_afternoon",
        interest=_I["football"],
        description="Liga 2 home game. Meet at the main gate.",
        signup_count=4,
    ),
]
_EVENTS_BY_ID = {e.id: e for e in MOCK_EVENTS}

MOCK_GROUP_ID = UUID("f1000000-0000-4000-8000-000000000001")


def _mock_group(event_id: UUID, me: dict) -> Group:
    # MOCK - replace: output of services/matching.py
    return Group(
        id=MOCK_GROUP_ID,
        event_id=event_id,
        meet_at=_get_event(event_id).starts_at - timedelta(minutes=30),
        note="Meet at the entrance 30 minutes before.",
        members=[
            GroupMember(user_id=me["id"], display_name=me.get("display_name"), is_student=bool(me.get("is_student"))),
            GroupMember(user_id=UUID("c1000000-0000-4000-8000-000000000002"), display_name="Andrei", is_student=True),
            GroupMember(user_id=UUID("c1000000-0000-4000-8000-000000000003"), display_name="Lucía", is_student=True),
            GroupMember(user_id=UUID("c1000000-0000-4000-8000-000000000004"), display_name="Ioana", is_student=False),
        ],
        why_you_match="You all like board games and live music, and are free on weekday evenings.",
    )


def _get_event(event_id: UUID) -> Event:
    event = _EVENTS_BY_ID.get(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="event not found")
    return event


@router.get("", response_model=list[Event])
def list_events(
    interest: str | None = Query(None, description="interest slug"),
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = Query(None),
):
    # MOCK - replace: filtered query on events
    events = MOCK_EVENTS
    if interest:
        events = [e for e in events if e.interest and e.interest.slug == interest]
    if from_:
        events = [e for e in events if e.starts_at >= from_]
    if to:
        events = [e for e in events if e.starts_at <= to]
    return events


@router.post("/{event_id}/join", response_model=SignupOut)
def join_event(event_id: UUID, user: dict = Depends(current_user)):
    _get_event(event_id)
    return SignupOut(event_id=event_id, status="waiting")  # MOCK - replace


@router.post("/{event_id}/leave", response_model=SignupOut)
def leave_event(event_id: UUID, user: dict = Depends(current_user)):
    _get_event(event_id)
    return SignupOut(event_id=event_id, status="left")  # MOCK - replace


@router.post("/{event_id}/match", response_model=MatchResult)
def run_match(event_id: UUID, user: dict = Depends(current_user)):
    _get_event(event_id)
    # MOCK - replace: form_groups over waiting signups, save event_groups and group_members
    return MatchResult(event_id=event_id, groups=[_mock_group(event_id, user)], unmatched_count=0)


@router.get("/{event_id}/my-group", response_model=Group)
def get_my_group(event_id: UUID, user: dict = Depends(current_user)):
    _get_event(event_id)
    # MOCK - replace: 404 "not in a group yet" when the user has no group for this event
    return _mock_group(event_id, user)
