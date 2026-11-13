"""Feature A (Person A): lease analysis with Gemini.

redact() strips personal IDs (CNP, IBAN, ID card, passport) from lease text. It runs before
anything is sent to Gemini and must also run before the lease text is saved.

analyze_lease() asks Gemini for a LeaseReport as structured JSON, validates it with Pydantic,
retries once on invalid output and raises GeminiError on any failure, so callers can still
return the price verdict.
"""

import json
import re
from pathlib import Path

from pydantic import ValidationError

from config import settings
from schemas.lease import LeaseReport

REDACTED = "[REDACTED]"
TIMEOUT_MS = 30_000
MAX_QUOTE_WORDS = 25

SAMPLE_DIR = Path(__file__).resolve().parents[2] / "data" / "sample_leases"
DEMO_LEASE = SAMPLE_DIR / "demo_ro.txt"
DEMO_REPORT = SAMPLE_DIR / "demo_ro.json"


class GeminiError(Exception):
    """Gemini is unavailable or returned something unusable. The message is safe to show."""


# ---------- redaction ----------

# IBAN: RO + 2 check digits + 4-letter bank code + 16 characters, spaces allowed between them.
# Case-sensitive on purpose, so ordinary words starting with "ro" never match.
_IBAN = re.compile(r"\bRO\d{2} ?[A-Z]{4}(?: ?[0-9A-Z]){16}\b")
# CNP: exactly 13 digits. Phone numbers (10 or 11 digits) and amounts are shorter.
_CNP = re.compile(r"(?<!\d)\d{13}(?!\d)")
# ID card: "seria XX nr. 000000", "seria TM, nr: 123456", or "CI TM123456".
_ID_CARD = re.compile(
    r"(?i:\bseria)\s*:?\s*[A-Z]{2}\s*,?\s*(?i:nr\.?|num[aă]r(?:ul)?)\s*:?\s*\d{6}\b"
    r"|\b(?:CI|C\.I\.|BI|B\.I\.)\s*:?\s*[A-Z]{2}\s?\d{6}\b"
)
# Passport: the keyword, an optional "nr.", then a 6 to 9 character number with a digit in it.
_PASSPORT = re.compile(
    r"((?i:pa[sș]aport(?:ul)?|passport)\s*(?i:nr\.?|no\.?|num[aă]r(?:ul)?)?\s*:?\s*)"
    r"(?=[A-Z0-9]*\d)[A-Z0-9]{6,9}\b"
)


def redact(text: str) -> str:
    """Replace CNP, IBAN, ID card series and number, and passport numbers with [REDACTED]."""
    text = _IBAN.sub(REDACTED, text)
    text = _ID_CARD.sub(REDACTED, text)
    text = _PASSPORT.sub(lambda m: m.group(1) + REDACTED, text)
    text = _CNP.sub(REDACTED, text)
    return text


# ---------- prompt ----------

_LANGUAGES = {"en": "English", "ro": "Romanian"}

_PROMPT = """You review residential lease contracts from Romania for tenants who are new to the
country (often international students). You are not a lawyer; point out risks and gaps in plain
words so the tenant knows what to ask about before signing.

Check the lease against this checklist:
1. Deposit (garanție): the amount, and when and how it is returned; deductions must be justified.
2. Rent increases: whether and how the rent can change during the contract.
3. Termination and notice: notice period and penalties for BOTH tenant and owner; flag lopsided terms.
4. Repairs: who pays for which repairs; structural repairs and installations are normally the owner's.
5. Utilities: which ones the tenant pays and how they are split or measured.
6. Owner access: the owner should give notice before entering; no unannounced entry.
7. Handover report and inventory (proces-verbal de predare-primire) with meter readings.
8. Registration of the contract with ANAF (the tax authority).
9. Payment method: a traceable method (bank transfer, receipts); cash-only or cash at the owner's choice is a risk.
Also flag other clauses that are unusual or unfair to the tenant, such as very high late fees.

Rules:
- risky_clauses: clauses that ARE in the text and are risky for the tenant. "quote" is copied
  verbatim from the lease in its original language, under {max_words} words (cut it short if
  needed). "category" is one of: deposit, rent_increase, termination, repairs, utilities,
  owner_access, handover, registration, payment, penalties, other.
- missing_clauses: checklist items the lease does not cover at all. Do not list an item that
  the lease covers, even if it covers it badly; that goes in risky_clauses.
- severity and overall_risk are low, medium or high. A fair lease is low.
- summary: two or three sentences.
- Write summary, why, suggestion and name in {language}. Only "quote" stays in the original language.
- "{redacted}" marks personal data removed for privacy; it is not a problem with the lease.
"""


def _system_prompt(ui_language: str) -> str:
    return _PROMPT.format(
        max_words=MAX_QUOTE_WORDS,
        language=_LANGUAGES.get(ui_language, "English"),
        redacted=REDACTED,
    )


# ---------- demo cache ----------


def _normalise(text: str) -> str:
    return " ".join(text.split())


def _demo_report(redacted: str, ui_language: str) -> LeaseReport | None:
    # The cached report is in English, so a Romanian UI still goes to Gemini.
    if not settings.DEMO_CACHE or ui_language != "en" or not DEMO_REPORT.exists():
        return None
    demo = redact(DEMO_LEASE.read_text(encoding="utf-8"))
    if _normalise(redacted) != _normalise(demo):
        return None
    return LeaseReport.model_validate_json(DEMO_REPORT.read_text(encoding="utf-8"))


# ---------- Gemini ----------


def _client():
    from google import genai
    from google.genai import types

    return genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=TIMEOUT_MS),
    )


def _config(ui_language: str):
    from google.genai import types

    # Gemini 3+ thinks by default and can exceed the 30 s timeout; LOW keeps it well under.
    # Gemini 2.x models use a different setting (thinking_budget), so leave them alone.
    thinking = None
    if not settings.GEMINI_MODEL.startswith("gemini-2"):
        thinking = types.ThinkingConfig(thinking_level="LOW")
    return types.GenerateContentConfig(
        system_instruction=_system_prompt(ui_language),
        response_mime_type="application/json",
        response_schema=LeaseReport,
        temperature=0.2,
        thinking_config=thinking,
    )


def _shorten_quotes(report: LeaseReport) -> LeaseReport:
    for clause in report.risky_clauses:
        words = clause.quote.split()
        if len(words) >= MAX_QUOTE_WORDS:
            clause.quote = " ".join(words[: MAX_QUOTE_WORDS - 1]) + " …"
    return report


def analyze_lease(text: str, ui_language: str = "en") -> LeaseReport:
    """Analyse a lease with Gemini. Always redacts first. Raises GeminiError on any failure."""
    redacted = redact(text)

    cached = _demo_report(redacted, ui_language)
    if cached is not None:
        return cached

    if not settings.GEMINI_API_KEY:
        raise GeminiError("Lease analysis is unavailable: GEMINI_API_KEY is not set.")

    client = _client()
    config = _config(ui_language)
    last_problem = ""
    for _attempt in range(2):  # first try plus one retry on invalid output
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL, contents=redacted, config=config
            )
        except Exception as exc:  # timeouts, network and API errors: no retry, fail fast
            raise GeminiError(f"Gemini request failed: {type(exc).__name__}") from exc
        try:
            return _shorten_quotes(LeaseReport.model_validate_json(response.text or ""))
        except (ValidationError, ValueError) as exc:
            last_problem = type(exc).__name__
    raise GeminiError(f"Gemini returned an invalid report twice ({last_problem}).")


if __name__ == "__main__":
    # Usage (from backend/): python -m services.gemini ../data/sample_leases/demo_ro.txt [en|ro]
    import sys

    lease = Path(sys.argv[1]).read_text(encoding="utf-8")
    lang = sys.argv[2] if len(sys.argv) > 2 else "en"
    print(json.dumps(analyze_lease(lease, lang).model_dump(), ensure_ascii=False, indent=2))
