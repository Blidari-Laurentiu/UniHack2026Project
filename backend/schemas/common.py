"""Models shared by both features."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

Slot = Literal[
    "weekday_morning",
    "weekday_evening",
    "weekend_morning",
    "weekend_afternoon",
    "weekend_evening",
]


class ErrorResponse(BaseModel):
    detail: str


class UserOut(BaseModel):
    id: UUID
    display_name: str | None = None
    email: str | None = None
    is_student: bool = False
    created_at: datetime | None = None
