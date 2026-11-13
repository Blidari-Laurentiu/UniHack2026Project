"""Unit tests for the pure matcher (no database)."""

import random
from datetime import datetime, timedelta, timezone

import pytest

from services.matching import FALLBACK_WHY, form_groups, jaccard, score, why_you_match

INTERESTS = ["theatre", "live_music", "board_games", "football", "hiking", "language_exchange"]
SLOTS = ["weekday_morning", "weekday_evening", "weekend_morning", "weekend_afternoon", "weekend_evening"]
T0 = datetime(2026, 11, 13, 12, 0, tzinfo=timezone.utc)


def user(i, interests=(), availability=(), joined_at=None):
    return {
        "id": f"u{i:03d}",
        "interests": list(interests),
        "availability": list(availability),
        "joined_at": joined_at if joined_at is not None else T0 + timedelta(minutes=i),
    }


def make_users(n, seed=1):
    rng = random.Random(seed)
    return [
        user(i, rng.sample(INTERESTS, rng.randint(0, 4)), rng.sample(SLOTS, rng.randint(0, 3)))
        for i in range(n)
    ]


def ids(group):
    return [m["id"] for m in group["members"]]


# --- jaccard and score ---


def test_jaccard():
    assert jaccard([], []) == 0.0
    assert jaccard(["a"], []) == 0.0
    assert jaccard(["a", "b"], ["a", "b"]) == 1.0
    assert jaccard(["a", "b"], ["b", "c"]) == pytest.approx(1 / 3)
    assert jaccard(["a", "a", "b"], {"a"}) == 0.5  # duplicates do not count twice


def test_score_weights():
    a = user(1, ["theatre"], ["weekday_evening"])
    assert score(a, user(2, ["theatre"], ["weekday_evening"])) == pytest.approx(1.0)
    assert score(a, user(3, ["theatre"], ["weekend_morning"])) == pytest.approx(0.6)
    assert score(a, user(4, ["football"], ["weekday_evening"])) == pytest.approx(0.4)
    assert score(a, user(5)) == 0.0
    assert score(a, {"id": "x"}) == 0.0  # missing keys are treated as empty


# --- group sizes ---


@pytest.mark.parametrize("n", [0, 2, 3, 7, 12, 40])
def test_group_invariants(n):
    users = make_users(n)
    groups = form_groups(users)

    placed = [uid for g in groups for uid in ids(g)]
    assert len(placed) == len(set(placed)), "somebody is in two groups"
    assert all(3 <= len(g["members"]) <= 5 for g in groups)
    assert all(g["why_you_match"] for g in groups)
    if n >= 3:
        assert sorted(placed) == sorted(u["id"] for u in users), "somebody was left out"
    else:
        assert groups == []


@pytest.mark.parametrize("n", range(3, 61))
def test_everyone_placed_for_every_pool_size(n):
    groups = form_groups(make_users(n, seed=n))
    sizes = [len(g["members"]) for g in groups]
    assert sum(sizes) == n
    assert all(3 <= s <= 5 for s in sizes)


@pytest.mark.parametrize(
    "n,expected",
    [(3, [3]), (4, [4]), (5, [5]), (6, [3, 3]), (7, [4, 3]), (8, [4, 4]), (9, [5, 4]), (10, [5, 5]), (11, [4, 4, 3])],
)
def test_planned_sizes(n, expected):
    sizes = sorted((len(g["members"]) for g in form_groups(make_users(n))), reverse=True)
    assert sizes == expected


# --- behaviour ---


def test_deterministic_and_independent_of_input_order():
    users = make_users(40)
    first = [ids(g) for g in form_groups(users)]
    assert [ids(g) for g in form_groups(users)] == first

    shuffled = users[:]
    random.Random(7).shuffle(shuffled)
    assert [ids(g) for g in form_groups(shuffled)] == first


def test_input_is_not_modified():
    users = make_users(12)
    before = [dict(u) for u in users]
    form_groups(users)
    assert users == before


def test_first_group_starts_from_longest_waiting_user():
    users = make_users(12)
    users[5]["joined_at"] = T0 - timedelta(days=1)
    assert form_groups(users)[0]["members"][0]["id"] == "u005"


def test_similar_people_end_up_together():
    gamers = [user(i, ["board_games", "live_music"], ["weekday_evening"]) for i in (0, 2, 4, 6)]
    hikers = [user(i, ["hiking", "football"], ["weekend_morning"]) for i in (1, 3, 5, 7)]
    groups = form_groups(gamers + hikers)
    assert sorted(sorted(ids(g)) for g in groups) == [
        ["u000", "u002", "u004", "u006"],
        ["u001", "u003", "u005", "u007"],
    ]


def test_zero_availability_overlap_is_not_dropped():
    # Same interests, no slot in common: they still joined the same event.
    users = [user(i, ["theatre"], [SLOTS[i]]) for i in range(4)]
    groups = form_groups(users)
    assert len(groups) == 1 and len(groups[0]["members"]) == 4


def test_users_with_empty_profiles_are_still_grouped():
    groups = form_groups([user(i) for i in range(5)])
    assert [len(g["members"]) for g in groups] == [5]
    assert groups[0]["why_you_match"] == FALLBACK_WHY


def test_duplicate_user_is_placed_once():
    users = make_users(7) + [make_users(7)[0]]
    placed = [uid for g in form_groups(users) for uid in ids(g)]
    assert len(placed) == 7 == len(set(placed))


def test_leftover_joins_the_group_it_fits_best():
    gamers = [user(i, ["board_games"], ["weekday_evening"]) for i in range(4)]
    hikers = [user(i, ["hiking"], ["weekend_morning"]) for i in range(4, 8)]
    late_hiker = user(8, ["hiking"], ["weekend_morning"])
    groups = form_groups(gamers + hikers + [late_hiker])
    assert [len(g["members"]) for g in groups] == [4, 5]
    assert "u008" in ids(groups[1])


def test_bad_sizes_are_rejected():
    with pytest.raises(ValueError):
        form_groups(make_users(5), target=6, max_size=5)


# --- why_you_match ---


def test_why_shared_interests_and_slots():
    members = [user(i, ["board_games", "live_music", f"x{i}"], ["weekday_evening"]) for i in range(4)]
    labels = {"board_games": "Board games", "live_music": "Live music"}
    assert why_you_match(members, labels) == (
        "You all like board games and live music, and are free on weekday evenings."
    )


def test_why_uses_slug_when_label_is_missing():
    members = [user(i, ["language_exchange"]) for i in range(3)]
    assert why_you_match(members) == "You all like language exchange."


def test_why_majority_interest():
    members = [user(0, ["theatre"]), user(1, ["theatre"]), user(2, ["theatre"]), user(3, ["football"])]
    assert why_you_match(members) == "Most of you like theatre."


def test_why_only_slots():
    members = [user(i, [f"x{i}"], ["weekend_afternoon"]) for i in range(3)]
    assert why_you_match(members) == "You are all free on weekend afternoons."
