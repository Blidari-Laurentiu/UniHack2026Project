"""Gemini service: redaction, validation, retry, errors and the demo cache.

Nothing here calls Gemini: the client is replaced with a fake.
"""

import json
import re
from types import SimpleNamespace

import pytest

from services import gemini
from services.gemini import REDACTED, GeminiError, analyze_lease, redact

# ---------- redaction ----------


@pytest.mark.parametrize(
    "text",
    [
        "CNP 0000000000000,",
        "CNP: 1960523350011",
        "cod numeric personal 2990101123456.",
    ],
)
def test_redacts_cnp(text):
    out = redact(text)
    assert REDACTED in out
    assert not re.search(r"\d{13}", out)


@pytest.mark.parametrize(
    "text",
    [
        "IBAN RO00 XXXX 0000 0000 0000 0000, deschis",
        "IBAN RO49AAAA1B31007593840000.",
        "cont RO49 AAAA 1B31 0075 9384 0000",
    ],
)
def test_redacts_iban(text):
    out = redact(text)
    assert REDACTED in out
    assert "RO49" not in out and "RO00" not in out


@pytest.mark.parametrize(
    "text",
    [
        "identificat cu CI seria XX nr. 000000, CNP",
        "C.I. seria TM, nr: 123456",
        "carte de identitate Seria TM numărul 654321",
        "CI TM123456",
    ],
)
def test_redacts_id_card(text):
    out = redact(text)
    assert REDACTED in out
    assert not re.search(r"\d{6}", out)


@pytest.mark.parametrize(
    "text",
    [
        "identificată cu pașaport nr. X0000000, în calitate",
        "pasaport 051234567",
        "passport no. AB1234567",
    ],
)
def test_redacts_passport(text):
    out = redact(text)
    assert REDACTED in out
    assert not re.search(r"\d{6}", out)


def test_passport_keyword_without_number_is_kept():
    text = "Chiriașul prezintă pașaportul valabil la semnare."
    assert redact(text) == text


@pytest.mark.parametrize(
    "text",
    [
        "Chiria lunară este de 500 (cinci sute) EUR, garanție 1.000 EUR.",
        "Chiria este 2.350,50 lei pe lună.",
        "începând cu data de 15.10.2026 până la data de 14.10.2027",
        "Telefon: 0722 123 456 sau 0256123456 sau +40 722 123 456.",
        "Contract nr. 17 din 02.10.2026, ap. 19, et. 4, 54 mp.",
        "România, Romania, ROMÂNIA și Rotonda sunt cuvinte obișnuite.",
    ],
)
def test_leaves_amounts_dates_and_phones_alone(text):
    assert redact(text) == text


def test_sample_leases_have_no_ids_left():
    leases = sorted(gemini.SAMPLE_DIR.glob("*.txt"))
    assert {p.name for p in leases} >= {"demo_ro.txt", "fair_ro.txt", "missing_clauses_ro.txt"}
    for path in leases:
        out = redact(path.read_text(encoding="utf-8"))
        assert REDACTED in out, path.name
        for leftover in ("0000000000000", "RO00", "XXXX", "seria XX", "X0000000", "000000"):
            assert leftover not in out, f"{leftover!r} left in {path.name}"
        # Amounts that must survive.
        assert "EUR" in out


# ---------- analyze_lease with a fake client ----------

VALID = {
    "summary": "A fair lease.",
    "overall_risk": "low",
    "risky_clauses": [
        {
            "quote": "Proprietarul poate intra oricând.",
            "category": "owner_access",
            "severity": "high",
            "why": "No notice.",
            "suggestion": "Ask for 48 hours' notice.",
        }
    ],
    "missing_clauses": [{"name": "Handover report", "why": "No record of the flat's state."}],
}


class FakeModels:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    def generate_content(self, *, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return SimpleNamespace(text=reply)


@pytest.fixture
def fake(monkeypatch):
    """Install a fake Gemini client; call fake(replies) to set what it answers."""
    monkeypatch.setattr(gemini.settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gemini.settings, "DEMO_CACHE", False)

    def install(replies):
        models = FakeModels(replies)
        monkeypatch.setattr(gemini, "_client", lambda: SimpleNamespace(models=models))
        return models

    return install


LEASE = "Contract de închiriere. Proprietar cu CNP 1960523350011, IBAN RO49AAAA1B31007593840000."


def test_valid_reply(fake):
    models = fake([json.dumps(VALID)])
    report = analyze_lease(LEASE, "en")
    assert report.overall_risk == "low"
    assert report.risky_clauses[0].category == "owner_access"
    assert len(models.calls) == 1


def test_sends_only_redacted_text_and_uses_structured_output(fake):
    models = fake([json.dumps(VALID)])
    analyze_lease(LEASE, "ro")
    call = models.calls[0]
    assert "1960523350011" not in call["contents"]
    assert "RO49" not in call["contents"]
    assert REDACTED in call["contents"]
    assert call["model"] == gemini.settings.GEMINI_MODEL
    assert call["config"].response_mime_type == "application/json"
    assert call["config"].response_schema is gemini.LeaseReport
    assert "Romanian" in call["config"].system_instruction


def test_retries_once_on_invalid_output(fake):
    models = fake(["not json", json.dumps(VALID)])
    report = analyze_lease(LEASE)
    assert report.summary == "A fair lease."
    assert len(models.calls) == 2


def test_invalid_twice_raises(fake):
    bad = dict(VALID, overall_risk="catastrophic")
    models = fake([json.dumps(bad), ""])
    with pytest.raises(GeminiError, match="invalid report"):
        analyze_lease(LEASE)
    assert len(models.calls) == 2


def test_api_error_raises_without_retry(fake):
    models = fake([TimeoutError("read timed out")])
    with pytest.raises(GeminiError, match="request failed"):
        analyze_lease(LEASE)
    assert len(models.calls) == 1


def test_missing_key_raises(monkeypatch):
    monkeypatch.setattr(gemini.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(gemini.settings, "DEMO_CACHE", False)
    monkeypatch.setattr(gemini, "_client", lambda: pytest.fail("client must not be built"))
    with pytest.raises(GeminiError, match="GEMINI_API_KEY"):
        analyze_lease(LEASE)


def test_long_quote_is_shortened(fake):
    long_reply = json.loads(json.dumps(VALID))
    long_reply["risky_clauses"][0]["quote"] = " ".join(["cuvânt"] * 40)
    fake([json.dumps(long_reply)])
    report = analyze_lease(LEASE)
    assert len(report.risky_clauses[0].quote.split()) <= gemini.MAX_QUOTE_WORDS


# ---------- demo cache ----------


def test_demo_cache_skips_gemini(monkeypatch):
    if not gemini.DEMO_REPORT.exists():
        pytest.skip("demo_ro.json not generated yet")
    monkeypatch.setattr(gemini.settings, "DEMO_CACHE", True)
    monkeypatch.setattr(gemini.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(gemini, "_client", lambda: pytest.fail("Gemini must not be called"))
    demo = gemini.DEMO_LEASE.read_text(encoding="utf-8")
    # Pasting through a textarea can change line endings and trailing spaces.
    report = analyze_lease(demo.replace("\n", "\r\n") + "  \n")
    assert report.risky_clauses


def test_demo_cache_off_or_other_text_calls_gemini(fake, monkeypatch):
    models = fake([json.dumps(VALID), json.dumps(VALID)])
    demo = gemini.DEMO_LEASE.read_text(encoding="utf-8")
    analyze_lease(demo)  # DEMO_CACHE is off in the fixture
    monkeypatch.setattr(gemini.settings, "DEMO_CACHE", True)
    analyze_lease(demo + "\n10.1. O clauză în plus.")
    assert len(models.calls) == 2


def test_demo_cache_is_english_only(fake, monkeypatch):
    models = fake([json.dumps(VALID)])
    monkeypatch.setattr(gemini.settings, "DEMO_CACHE", True)
    analyze_lease(gemini.DEMO_LEASE.read_text(encoding="utf-8"), "ro")
    assert len(models.calls) == 1
