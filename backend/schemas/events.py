"""Feature B (Person B): events, profile and groups."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, StringConstraints

from schemas.common import Slot

SignupStatus = Literal["waiting", "grouped", "left"]
# Only 'active' events are on the public list. 'pending' waits for a moderator, 'rejected'
# was removed by one; the creator still sees both in their own list.
EventStatus = Literal["active", "pending", "rejected"]


class Interest(BaseModel):
    id: UUID
    slug: str
    label: str


class Event(BaseModel):
    id: UUID
    title: str
    venue: str | None
    starts_at: datetime
    slot: Slot | None
    interest: Interest | None
    description: str | None
    signup_count: int
    my_status: SignupStatus | None = None  # set only for a logged-in caller
    status: EventStatus = "active"
    created_by_me: bool = False


def _text(min_length: int, max_length: int):
    return Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)
    ]


class EventIn(BaseModel):
    title: _text(3, 100)
    venue: _text(2, 100)
    starts_at: AwareDatetime  # the slot is worked out from it, in Timișoara time
    interest_slug: str | None = None
    description: _text(0, 1000) | None = None


class ReportIn(BaseModel):
    reason: _text(5, 500)


class ReportOut(BaseModel):
    event_id: UUID
    status: Literal["received"] = "received"


class ProfileIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=64)
    interest_slugs: list[str] = Field(default_factory=list, max_length=20)
    availability: list[Slot] = Field(default_factory=list)


class ProfileOut(BaseModel):
    user_id: UUID
    display_name: str | None
    is_student: bool
    interests: list[Interest]
    availability: list[Slot]
    avatar_url: str | None = None  # path of GET /profile/avatar/{user_id}; None: show the mascot


class SignupOut(BaseModel):
    event_id: UUID
    status: SignupStatus


class GroupMember(BaseModel):
    user_id: UUID
    display_name: str | None
    is_student: bool
    avatar_url: str | None = None


class Group(BaseModel):
    id: UUID
    event_id: UUID
    meet_at: datetime | None
    note: str | None
    members: list[GroupMember]
    why_you_match: str


class MatchResult(BaseModel):
    event_id: UUID
    groups: list[Group]
    unmatched_count: int


# --- moderation (routers/moderation.py) ---


class EventCreator(BaseModel):
    user_id: UUID
    display_name: str | None


class ModerationReport(BaseModel):
    id: UUID
    reason: str
    created_at: datetime
    reporter_name: str | None


class ModerationEvent(BaseModel):
    id: UUID
    title: str
    venue: str | None
    starts_at: datetime
    interest: Interest | None
    description: str | None
    status: EventStatus
    created_at: datetime | None
    created_by: EventCreator | None  # None: a seeded event, or the creator deleted their account
    signup_count: int
    reports: list[ModerationReport]  # the open ones, newest first


class ModerationResult(BaseModel):
    event_id: UUID
    status: EventStatus
