"""Feature B: group matching as pure functions (no database, no clock, no randomness).

Everyone in the pool already joined the same event, so nobody is ever dropped for
having no availability overlap. Availability only favours people who could meet again.

A user is a dict:
    {"id": ..., "interests": [slug, ...], "availability": [slot, ...],
     "joined_at": datetime | None, ...any other keys are passed through}
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable

INTEREST_WEIGHT = 0.6
AVAILABILITY_WEIGHT = 0.4

SLOT_PHRASES = {
    "weekday_morning": "weekday mornings",
    "weekday_evening": "weekday evenings",
    "weekend_morning": "weekend mornings",
    "weekend_afternoon": "weekend afternoons",
    "weekend_evening": "weekend evenings",
}
FALLBACK_WHY = "You are all going to this event and looking for company."


def jaccard(a: Iterable, b: Iterable) -> float:
    """Size of the intersection over size of the union; 0.0 when both are empty."""
    a, b = set(a), set(b)
    union = a | b
    return len(a & b) / len(union) if union else 0.0


def score(a: dict, b: dict) -> float:
    """How well two users fit, from 0.0 to 1.0."""
    return (
        INTEREST_WEIGHT * jaccard(a.get("interests") or (), b.get("interests") or ())
        + AVAILABILITY_WEIGHT * jaccard(a.get("availability") or (), b.get("availability") or ())
    )


def _fit(user: dict, members: list[dict]) -> float:
    """Average score between a user and the members of a group."""
    return sum(score(user, m) for m in members) / len(members)


def _waiting_order(users: list[dict]) -> list[dict]:
    """Longest-waiting first; users without joined_at last; id breaks ties."""
    return sorted(
        users,
        key=lambda u: (u.get("joined_at") is None, u.get("joined_at") or 0, str(u["id"])),
    )


def _plan(n: int, target: int, max_size: int, min_size: int) -> tuple[list[int], int]:
    """Group sizes to build greedily, and how many leftovers to add afterwards.

    Returns ([], 0) when n is under min_size. Otherwise everyone is placed whenever
    the sizes allow it (always, with the default 4 / 5 / 3).
    """
    if n < min_size:
        return [], 0
    full, rest = divmod(n, target)
    if rest == 0:
        return [target] * full, 0
    if rest >= min_size:
        return [target] * full + [rest], 0
    if rest <= full * (max_size - target):
        return [target] * full, rest  # 1 or 2 leftovers join existing groups
    if n >= (full + 1) * min_size:
        # Leftovers do not fit (e.g. 6 people): split evenly instead, 3 + 3.
        base, extra = divmod(n, full + 1)
        return [base + 1] * extra + [base] * (full + 1 - extra), 0
    return [target] * full, full * (max_size - target)  # some stay unmatched


def _join_words(words: list[str]) -> str:
    if len(words) <= 1:
        return "".join(words)
    return ", ".join(words[:-1]) + " and " + words[-1]


def why_you_match(members: list[dict], labels: dict[str, str] | None = None) -> str:
    """One sentence built from the interests and slots the members share."""
    labels = labels or {}

    def label(slug: str) -> str:
        return labels.get(slug, slug.replace("_", " ")).lower()

    interest_sets = [set(m.get("interests") or ()) for m in members]
    slot_sets = [set(m.get("availability") or ()) for m in members]
    shared = sorted(set.intersection(*interest_sets), key=label) if members else []
    shared_slots = [s for s in SLOT_PHRASES if all(s in slots for slots in slot_sets)] if members else []

    parts = []
    if shared:
        parts.append("You all like " + _join_words([label(s) for s in shared[:3]]))
    else:
        counts = Counter(slug for interests in interest_sets for slug in interests)
        majority = [
            slug
            for slug, count in sorted(counts.items(), key=lambda kv: (-kv[1], label(kv[0])))
            if count >= 2 and count * 2 >= len(members)
        ]
        if majority:
            parts.append("Most of you like " + _join_words([label(s) for s in majority[:2]]))

    if shared_slots:
        free = _join_words([SLOT_PHRASES[s] for s in shared_slots[:2]])
        parts.append(f"are free on {free}" if parts else f"You are all free on {free}")

    if not parts:
        return FALLBACK_WHY
    return (", and ".join(parts) if len(parts) == 2 else parts[0]) + "."


def form_groups(
    users: list[dict],
    target: int = 4,
    max_size: int = 5,
    min_size: int = 3,
    labels: dict[str, str] | None = None,
) -> list[dict]:
    """Split the waiting pool of one event into groups of min_size to max_size.

    Greedy: each group starts from the longest-waiting user who is not placed yet and
    takes the best-fitting users until it has its planned size. One or two leftovers
    join the existing group they fit best, up to max_size. Fewer than min_size users
    gives no groups. The same input always gives the same output.

    Returns [{"members": [user, ...], "why_you_match": str}, ...].
    """
    if not (1 <= min_size <= target <= max_size):
        raise ValueError("need 1 <= min_size <= target <= max_size")

    seen = set()
    pool = []
    for user in _waiting_order(list(users)):
        if user["id"] not in seen:  # a user can only be in one group
            seen.add(user["id"])
            pool.append(user)

    sizes, leftovers = _plan(len(pool), target, max_size, min_size)

    groups: list[list[dict]] = []
    for size in sizes:
        members = [pool.pop(0)]
        while len(members) < size:
            # max() keeps the first of equal candidates, so ties go to the longest-waiting.
            best = max(pool, key=lambda u: _fit(u, members))
            pool.remove(best)
            members.append(best)
        groups.append(members)

    for _ in range(leftovers):
        user = pool.pop(0)
        open_groups = [g for g in groups if len(g) < max_size]
        max(open_groups, key=lambda g: _fit(user, g)).append(user)

    return [{"members": g, "why_you_match": why_you_match(g, labels)} for g in groups]
