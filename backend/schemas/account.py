"""Account settings response bodies."""

from typing import Literal

from pydantic import BaseModel

LoginMethod = Literal["password", "google", "github", "email_code", "dev", "other"]


class MfaOut(BaseModel):
    available: bool  # the server can read and remove it (Management API set up, real account)
    enabled: bool | None  # None: Auth0 could not be asked right now
    required: bool  # admin accounts must keep it on


class AccountOut(BaseModel):
    login_method: LoginMethod
    email: str | None
    can_change_password: bool  # only accounts that sign in with a password
    mfa: MfaOut
    can_delete: bool


class PasswordResetOut(BaseModel):
    sent_to: str
