"""Student verification request and response bodies."""

from datetime import datetime

from pydantic import BaseModel, Field


class UniversityOut(BaseModel):
    slug: str
    name: str
    domains: list[str]


class StudentStartIn(BaseModel):
    university: str = Field(min_length=1, max_length=32)
    email: str = Field(min_length=3, max_length=254)


class PendingOut(BaseModel):
    university: str
    student_email: str
    expires_at: datetime
    resend_after: datetime


class StudentStatusOut(BaseModel):
    is_student: bool
    university: str | None = None  # slug
    student_email: str | None = None
    verified_at: datetime | None = None
    pending: PendingOut | None = None  # a code was sent and can still be typed


class StudentConfirmIn(BaseModel):
    code: str = Field(min_length=1, max_length=16)
