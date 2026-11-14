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

# Student status lasts one year from the day the code was confirmed; after that the user
# verifies again. VALID_FOR is SQL (an interval) because the check runs in the database.
VALID_FOR = "interval '1 year'"


def active_sql(alias: str = "") -> str:
    """SQL expression: is this users row a student right now?

    True when is_student is set and the verification is under a year old. Sample users
    (db/seed_events.py) have is_student without a verification date and never expire.
    Read is_student through this everywhere; the stored flag alone goes stale.
    """
    p = f"{alias}." if alias else ""
    return (
        f"coalesce({p}is_student and ({p}student_verified_at is null"
        f" or {p}student_verified_at + {VALID_FOR} > now()), false)"
    )


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


def has_plus_tag(email: str) -> bool:
    """ana+x@e-uvt.ro reaches ana@e-uvt.ro: one mailbox could verify many accounts."""
    return "+" in email.rsplit("@", 1)[0]


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
