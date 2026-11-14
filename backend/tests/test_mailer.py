"""services/mailer.py: which way it sends and what it sends. No network: urlopen and SMTP are fakes."""

import io
import json
import urllib.error

import pytest

from config import settings
from services import mailer


@pytest.fixture
def brevo(monkeypatch):
    """Brevo configured; captures the HTTP request instead of sending it."""
    monkeypatch.setattr(settings, "MAIL_FROM", "Newcomer Hub <hub@example.com>")
    monkeypatch.setattr(settings, "BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    class Sent(list):
        urlopen = None

    sent = Sent()

    class Response(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def fake_urlopen(request, timeout):
        sent.append({"request": request, "timeout": timeout, "body": json.loads(request.data)})
        if getattr(fake_urlopen, "error", None):
            raise fake_urlopen.error
        return Response(b'{"messageId": "<1@brevo>"}')

    monkeypatch.setattr(mailer.urllib.request, "urlopen", fake_urlopen)
    sent.urlopen = fake_urlopen
    return sent


def test_brevo_request(brevo):
    mailer.send_email("ana@e-uvt.ro", "Your code: 123456", "Your code is 123456\n")
    (call,) = brevo
    req = call["request"]
    assert req.full_url == "https://api.brevo.com/v3/smtp/email"
    assert req.get_method() == "POST"
    assert req.get_header("Api-key") == "xkeysib-test"
    assert req.get_header("Content-type") == "application/json"
    assert call["timeout"] == mailer.TIMEOUT_SECONDS
    assert call["body"] == {
        "sender": {"name": "Newcomer Hub", "email": "hub@example.com"},
        "to": [{"email": "ana@e-uvt.ro"}],
        "subject": "Your code: 123456",
        "textContent": "Your code is 123456\n",
    }


def test_sender_without_a_name(brevo, monkeypatch):
    monkeypatch.setattr(settings, "MAIL_FROM", "hub@example.com")
    mailer.send_email("ana@e-uvt.ro", "s", "t")
    assert brevo[0]["body"]["sender"] == {"email": "hub@example.com"}


def test_brevo_error_is_a_mail_error_without_the_key(brevo, caplog):
    body = io.BytesIO(b'{"code": "unauthorized", "message": "Sender hub@example.com is not valid"}')
    brevo.urlopen.error = urllib.error.HTTPError(mailer.BREVO_URL, 400, "Bad Request", {}, body)
    with caplog.at_level("WARNING", logger="uvicorn.error"):
        with pytest.raises(mailer.MailError, match="HTTP 400: Sender hub@example.com is not valid"):
            mailer.send_email("ana@e-uvt.ro", "s", "t")
    assert "Sender hub@example.com is not valid" in caplog.text
    assert "xkeysib-test" not in caplog.text


def test_mail_error_is_an_oserror():
    """routers/student.py turns OSError into 503 and removes the unsent code."""
    assert issubclass(mailer.MailError, OSError)


def test_network_error_propagates(brevo):
    brevo.urlopen.error = urllib.error.URLError("timed out")
    with pytest.raises(OSError):
        mailer.send_email("ana@e-uvt.ro", "s", "t")


@pytest.mark.parametrize(
    "mail_from,key,host,ok",
    [
        ("Hub <hub@example.com>", "k", "", True),
        ("hub@example.com", "", "smtp.example.com", True),
        ("", "k", "", False),  # no sender
        ("Newcomer Hub", "k", "", False),  # a name is not an address
        ("Newcomer Hub hub@example.com", "k", "", False),  # no angle brackets
        ("Newcomer Hub <hub@example>", "k", "", False),
        ("Hub <hub@example.com>", "", "", False),  # no way to send
    ],
)
def test_mail_configured(monkeypatch, mail_from, key, host, ok):
    monkeypatch.setattr(settings, "MAIL_FROM", mail_from)
    monkeypatch.setattr(settings, "BREVO_API_KEY", key)
    monkeypatch.setattr(settings, "SMTP_HOST", host)
    assert mailer.mail_configured() is ok
    if not ok:
        with pytest.raises(mailer.MailNotConfigured):
            mailer.send_email("ana@e-uvt.ro", "s", "t")


def test_brevo_wins_over_smtp(brevo, monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(mailer, "_send_smtp", lambda *a: pytest.fail("SMTP used"))
    mailer.send_email("ana@e-uvt.ro", "s", "t")
    assert len(brevo) == 1


def test_smtp_when_no_brevo_key(monkeypatch):
    monkeypatch.setattr(settings, "MAIL_FROM", "Hub <hub@example.com>")
    monkeypatch.setattr(settings, "BREVO_API_KEY", "")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USER", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pw")
    log = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            log.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self, context):
            log.append(("starttls",))

        def login(self, user, password):
            log.append(("login", user))

        def send_message(self, msg):
            log.append(("send", msg["From"], msg["To"], msg["Subject"]))

    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    mailer.send_email("ana@e-uvt.ro", "Subject", "Body")
    assert log == [
        ("connect", "smtp.example.com", 587),
        ("starttls",),
        ("login", "user"),
        ("send", "Hub <hub@example.com>", "ana@e-uvt.ro", "Subject"),
    ]
