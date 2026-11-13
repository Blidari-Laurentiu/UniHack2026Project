"""Feature B (Person B): events, profile and groups."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from schemas.common import Slot

SignupStatus = Literal["waiting", "grouped", "left"]


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


class ProfileIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=64)
    interest_slugs: list[str] = Field(default_factory=list, max_length=20)
    availability: list[Slot] = Field(default_factory=list)


class ProfileOut(BaseModel):
    display_name: str | None
    is_student: bool
    interests: list[Interest]
    availability: list[Slot]


class SignupOut(BaseModel):
    event_id: UUID
    status: SignupStatus


class GroupMember(BaseModel):
    user_id: UUID
    display_name: str | None
    is_student: bool


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
