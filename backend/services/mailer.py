"""Outgoing email over SMTP (standard library only). Used for student verification codes."""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from config import settings

log = logging.getLogger("uvicorn.error")

TIMEOUT_SECONDS = 15


class MailNotConfigured(Exception):
    """SMTP_HOST is empty."""


def mail_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


def send_email(to: str, subject: str, text: str) -> None:
    """Send one plain-text email. Raises MailNotConfigured, or OSError/SMTPException on failure."""
    if not mail_configured():
        raise MailNotConfigured()

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)

    context = ssl.create_default_context()
    if settings.SMTP_PORT == 465:
        smtp = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=TIMEOUT_SECONDS, context=context)
    else:
        smtp = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=TIMEOUT_SECONDS)
    with smtp:
        if settings.SMTP_PORT != 465:
            smtp.starttls(context=context)
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)
