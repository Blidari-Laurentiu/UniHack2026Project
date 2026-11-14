"""Feature A (Person A): text from an uploaded lease PDF.

extract_text() reads the text layer of a PDF with pypdf (pure Python). Nothing is saved and
nothing is sent to Gemini here: the text goes back to the browser, the user reads it, and it
then takes the usual path through POST /lease/analyze, where it is redacted.

A scanned PDF has no text layer; there is no OCR, so the user is told to paste the text.
Every failure raises PdfError with a message that is safe to show and an HTTP status.
"""

import io
import logging
import re
import unicodedata

from pypdf import PdfReader

from schemas.lease import LEASE_TEXT_MAX, LEASE_TEXT_MIN

log = logging.getLogger("uvicorn.error")

MAX_BYTES = 5 * 1024 * 1024
MAX_PAGES = 40

TOO_BIG = "The PDF is too big: at most 5 MB. Paste the lease text instead."
NOT_PDF = "This file is not a PDF. Choose a PDF, or paste the lease text."
UNREADABLE = "This PDF could not be read. Paste the lease text instead."
ENCRYPTED = "This PDF is password-protected. Paste the lease text instead."
TOO_MANY_PAGES = f"The PDF has too many pages: at most {MAX_PAGES}. Paste the lease text instead."
NO_TEXT = (
    "No text was found in this PDF. It is probably a scan (a photo of the pages). "
    "Paste the lease text instead."
)
TOO_LONG = (
    f"The text in this PDF is too long: at most {LEASE_TEXT_MAX:,} characters. "
    "Paste the part with the clauses instead."
)

# Control characters other than tab and newline. Postgres text cannot hold NUL at all.
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_TRAILING_SPACE = re.compile(r"[ \t]+\n")
_BLANK_LINES = re.compile(r"\n{3,}")


class PdfError(Exception):
    """The upload cannot be turned into lease text. The message is safe to show."""

    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def _clean(text: str) -> str:
    # NFC: PDFs often give "a" + combining breve; the rest of the app expects "ă".
    text = unicodedata.normalize("NFC", text).replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL.sub("", text)
    text = _TRAILING_SPACE.sub("\n", text)
    return _BLANK_LINES.sub("\n\n", text).strip()


def extract_text(data: bytes) -> tuple[str, int]:
    """Return (text, page count) for a PDF file's bytes. Raises PdfError."""
    if len(data) > MAX_BYTES:
        raise PdfError(TOO_BIG, 413)
    # The header may sit a little after the start (a BOM or junk bytes), as PDF readers accept.
    if b"%PDF-" not in data[:1024]:
        raise PdfError(NOT_PDF, 415)

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            # An empty user password (print or copy restrictions only) opens; a real one does not.
            raise PdfError(ENCRYPTED)
        pages = len(reader.pages)
        if pages > MAX_PAGES:
            raise PdfError(TOO_MANY_PAGES)

        parts: list[str] = []
        total = 0
        for page in reader.pages:
            part = page.extract_text() or ""
            parts.append(part)
            total += len(part)
            if total > 2 * LEASE_TEXT_MAX:  # far past the limit: stop reading
                raise PdfError(TOO_LONG)
    except PdfError:
        raise
    except Exception as exc:  # pypdf raises many types on damaged files
        log.warning("pdf text extraction failed: %s", type(exc).__name__)
        raise PdfError(UNREADABLE) from exc

    text = _clean("\n\n".join(parts))
    if len(text) < LEASE_TEXT_MIN:
        raise PdfError(NO_TEXT)
    if len(text) > LEASE_TEXT_MAX:
        raise PdfError(TOO_LONG)
    return text, pages
