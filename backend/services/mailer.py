"""Outgoing email, used for student verification codes. Standard library only.

Two ways to send, picked from the settings:
- Brevo's HTTPS API (BREVO_API_KEY). Use this on Render's free plan, which blocks the
  SMTP ports 25, 465 and 587.
- Plain SMTP (SMTP_HOST), for hosts that allow it.

Check the setup from backend/:  python -m services.mailer you@example.com
"""

import json
import logging
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import parseaddr

from config import settings

log = logging.getLogger("uvicorn.error")

TIMEOUT_SECONDS = 15
BREVO_URL = "https://api.brevo.com/v3/smtp/email"


class MailNotConfigured(Exception):
    """No MAIL_FROM, or neither BREVO_API_KEY nor SMTP_HOST."""


class MailError(OSError):
    """The provider refused or failed to send. The message says why, without secrets."""


def mail_configured() -> bool:
    has_sender = "@" in parseaddr(settings.MAIL_FROM)[1]
    return has_sender and bool(settings.BREVO_API_KEY or settings.SMTP_HOST)


def send_email(to: str, subject: str, text: str) -> None:
    """Send one plain-text email. Raises MailNotConfigured or MailError/OSError."""
    if not mail_configured():
        raise MailNotConfigured()
    if settings.BREVO_API_KEY:
        _send_brevo(to, subject, text)
    else:
        _send_smtp(to, subject, text)


def _send_brevo(to: str, subject: str, text: str) -> None:
    name, address = parseaddr(settings.MAIL_FROM)
    sender = {"email": address, **({"name": name} if name else {})}
    body = json.dumps(
        {"sender": sender, "to": [{"email": to}], "subject": subject, "textContent": text}
    ).encode()
    request = urllib.request.Request(
        BREVO_URL,
        data=body,
        method="POST",
        headers={
            "api-key": settings.BREVO_API_KEY,
            "accept": "application/json",
            "content-type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        # Brevo answers {"code": "...", "message": "..."}: log it, it says what to fix
        # (unverified sender, unknown IP, bad key). The key itself is never logged.
        try:
            detail = json.loads(exc.read() or b"{}").get("message", "")
        except (ValueError, AttributeError):
            detail = ""
        log.warning("Brevo refused the email: HTTP %s %s", exc.code, detail)
        raise MailError(f"Brevo answered HTTP {exc.code}: {detail}") from None


def _send_smtp(to: str, subject: str, text: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.MAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)

    context = ssl.create_default_context()
    if settings.SMTP_PORT == 465:
        smtp = smtplib.SMTP_SSL(
            settings.SMTP_HOST, settings.SMTP_PORT, timeout=TIMEOUT_SECONDS, context=context
        )
    else:
        smtp = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=TIMEOUT_SECONDS)
    with smtp:
        if settings.SMTP_PORT != 465:
            smtp.starttls(context=context)
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        sys.exit("usage: python -m services.mailer you@example.com")
    if not mail_configured():
        sys.exit("not configured: set MAIL_FROM and BREVO_API_KEY (or SMTP_HOST) in backend/.env")
    way = "Brevo API" if settings.BREVO_API_KEY else f"SMTP {settings.SMTP_HOST}"
    try:
        send_email(sys.argv[1], "Newcomer Hub test email", "If you can read this, sending works.\n")
    except Exception as exc:  # show the reason, then fail
        sys.exit(f"sending through {way} failed: {exc}")
    print(f"sent through {way} to {sys.argv[1]}; check the inbox and the spam folder")
