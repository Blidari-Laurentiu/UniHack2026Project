"""Student verification rules: which universities, which email domains, the one-time code."""

import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass
from datetime import timedelta

CODE_LENGTH = 6
CODE_TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5  # wrong codes per sent code
RESEND_AFTER = timedelta(seconds=60)
MAX_CODES_PER_HOUR = 5

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class University:
    slug: str
    name: str
    domains: tuple[str, ...]  # student mailbox domains, exact match after the @


# Student domains only: a staff domain (uvt.ro, upt.ro, umft.ro) must not make someone a student.
# USVT (former USAMVB) is missing: its student address domain is not confirmed yet. Add it
# here once known; nothing else changes.
UNIVERSITIES: tuple[University, ...] = (
    University("uvt", "Universitatea de Vest din Timișoara (UVT)", ("e-uvt.ro",)),
    University("upt", "Universitatea Politehnica Timișoara (UPT)", ("student.upt.ro",)),
    University(
        "umft",
        "Universitatea de Medicină și Farmacie „Victor Babeș” Timișoara (UMFT)",
        ("student.umft.ro",),
    ),
)
BY_SLUG = {u.slug: u for u in UNIVERSITIES}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def email_matches(university: University, email: str) -> bool:
    """True when `email` (normalized) is a mailbox on one of the university's student domains."""
    if not EMAIL_RE.match(email):
        return False
    return email.rsplit("@", 1)[1] in university.domains


def new_code() -> str:
    return f"{secrets.randbelow(10**CODE_LENGTH):0{CODE_LENGTH}d}"


def hash_code(verification_id, code: str) -> str:
    """The stored form of a code, bound to its row so a hash cannot be reused elsewhere."""
    return hashlib.sha256(f"{verification_id}:{code}".encode()).hexdigest()


def code_matches(verification_id, code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_code(verification_id, code), code_hash)
