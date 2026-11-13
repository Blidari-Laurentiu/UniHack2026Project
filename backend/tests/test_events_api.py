"""Feature B endpoints against the real schema.

Every test runs inside one database transaction that is rolled back at the end, so
nothing is ever saved. Skipped when there is no dev database (DATABASE_URL empty,
APP_ENV not "dev", or the server cannot be reached). Needs `python db/apply_schema.py`.
"""

import uuid
from datetime import datetime, timedelta, timezone

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from auth import current_user
from config import settings
from db import get_conn
from main import app
from routers.events import optional_user

pytestmark = pytest.mark.skipif(
    not settings.DATABASE_URL or settings.APP_ENV != "dev",
    reason="needs DATABASE_URL and APP_ENV=dev",
)

STARTS_AT = datetime(2099, 5, 16, 19, 0, tzinfo=timezone.utc)  # far future: always upcoming
JOINED_AT = datetime(2020, 1, 1, tzinfo=timezone.utc)  # seeded signups: before any real one
MISSING = "00000000-0000-4000-8000-000000000000"


class World:
    """Test data and the acting user for one test."""

    def __init__(self, conn):
        self.conn = conn
        self.tag = uuid.uuid4().hex[:8]
        self.user = None  # who the API sees; None = anonymous
        self.user_count = 0
        self.games = self.interest("games", "Test games")
        self.music = self.interest("music", "Test music")
        self.event_id = self.event("Test game night", self.games)

    def slug(self, name):
        return f"t_{self.tag}_{name}"

    def interest(self, name, label):
        self.conn.execute(
            "insert into interests (slug, label) values (%s, %s)", (self.slug(name), label)
        )
        return self.slug(name)

    def event(self, title, interest_slug, starts_at=STARTS_AT):
        return self.conn.execute(
            """
            insert into events (title, venue, starts_at, slot, interest_id, description)
            values (%s, 'Test venue', %s, 'weekend_evening',
                    (select id from interests where slug = %s), 'Test event')
            returning id
            """,
            (title, starts_at, interest_slug),
        ).fetchone()["id"]

    def new_user(self, name, interests=(), availability=(), is_student=False):
        row = self.conn.execute(
            "insert into users (auth0_sub, display_name, is_student) values (%s, %s, %s) "
            "returning id, auth0_sub, display_name, email, is_student, created_at",
            (f"test|{self.tag}|{name}", name, is_student),
        ).fetchone()
        for slug in interests:
            self.conn.execute(
                "insert into user_interests (user_id, interest_id) "
                "select %s, id from interests where slug = %s",
                (row["id"], slug),
            )
        for slot in availability:
            self.conn.execute(
                "insert into user_availability (user_id, slot) values (%s, %s)", (row["id"], slot)
            )
        return dict(row)

    def waiting_users(self, count, event_id=None):
        """count users with a profile, all waiting for the event, oldest signup first."""
        users = []
        for _ in range(count):
            self.user_count += 1
            n = self.user_count
            user = self.new_user(f"user{n}", [self.games], ["weekend_evening"])
            self.conn.execute(
                "insert into event_signups (event_id, user_id, status, created_at) "
                "values (%s, %s, 'waiting', %s)",
                (event_id or self.event_id, user["id"], JOINED_AT + timedelta(minutes=n)),
            )
            users.append(user)
        return users

    def status_of(self, user, event_id=None):
        row = self.conn.execute(
            "select status from event_signups where event_id = %s and user_id = %s",
            (event_id or self.event_id, user["id"]),
        ).fetchone()
        return row and row["status"]


@pytest.fixture(scope="module")
def connection():
    try:
        conn = psycopg.connect(settings.DATABASE_URL, row_factory=dict_row, connect_timeout=10)
    except psycopg.OperationalError as exc:
        pytest.skip(f"database not reachable: {type(exc).__name__}")
    conn.commit = lambda: None  # the endpoints commit; tests must never save anything
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


@pytest.fixture
def world(connection):
    try:
        yield World(connection)
    finally:
        connection.rollback()


@pytest.fixture
def client(world):
    def acting_user():
        if world.user is None:
            from auth import _unauthorized

            raise _unauthorized("missing bearer token")
        return world.user

    app.dependency_overrides[get_conn] = lambda: world.conn
    app.dependency_overrides[current_user] = acting_user
    app.dependency_overrides[optional_user] = lambda: world.user
    # No `with`: skips the lifespan, so the DB pool is never opened.
    yield TestClient(app)
    app.dependency_overrides.clear()


def events(client, world, **params):
    """List only this test's events."""
    r = client.get("/events", params={"interest": world.games, **params})
    assert r.status_code == 200, r.text
    return r.json()


# --- profile ---


def test_interests_are_public(client, world):
    slugs = [i["slug"] for i in client.get("/profile/interests").json()]
    assert world.games in slugs and world.music in slugs


def test_new_user_has_empty_profile(client, world):
    world.user = world.new_user("Mei", is_student=True)
    assert client.get("/profile").json() == {
        "display_name": "Mei",
        "is_student": True,
        "interests": [],
        "availability": [],
    }


def test_save_profile_replaces_everything(client, world):
    world.user = world.new_user("Mei", [world.music], ["weekday_morning"])
    body = {
        "display_name": "  Mei Lin ",
        "interest_slugs": [world.games, world.games],
        "availability": ["weekend_evening", "weekday_evening", "weekend_evening"],
    }
    r = client.put("/profile", json=body)
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved["display_name"] == "Mei Lin"
    assert [i["slug"] for i in saved["interests"]] == [world.games]
    assert saved["availability"] == ["weekday_evening", "weekend_evening"]  # fixed slot order
    assert client.get("/profile").json() == saved


def test_save_profile_rejects_unknown_interest_and_bad_slot(client, world):
    world.user = world.new_user("Mei", [world.music])
    r = client.put("/profile", json={"display_name": "Mei", "interest_slugs": ["no_such_thing"]})
    assert r.status_code == 422
    assert r.json() == {"detail": "unknown interest: no_such_thing"}
    assert [i["slug"] for i in client.get("/profile").json()["interests"]] == [world.music]

    r = client.put("/profile", json={"display_name": "Mei", "availability": ["friday_night"]})
    assert r.status_code == 422
    assert client.put("/profile", json={"display_name": "   "}).status_code == 422


# --- event list ---


def test_list_events_shape_and_filters(client, world):
    world.event("Test concert", world.music)
    world.event("Old game night", world.games, starts_at=datetime(2020, 1, 1, tzinfo=timezone.utc))

    listed = events(client, world)
    assert [e["title"] for e in listed] == ["Test game night"]  # past events are hidden
    event = listed[0]
    assert event["id"] == str(world.event_id)
    assert event["interest"]["slug"] == world.games
    assert event["slot"] == "weekend_evening"
    assert event["signup_count"] == 0
    assert event["my_status"] is None

    assert len(events(client, world, **{"from": "2019-01-01T00:00:00Z"})) == 2
    assert events(client, world, to="2098-01-01T00:00:00Z") == []
    assert events(client, world, **{"from": "2099-06-01T00:00:00Z"}) == []


def test_signup_count_and_my_status(client, world):
    world.waiting_users(2)
    assert events(client, world)[0]["signup_count"] == 2  # anonymous caller

    world.user = world.new_user("Mei")
    assert events(client, world)[0]["my_status"] is None
    client.post(f"/events/{world.event_id}/join")
    event = events(client, world)[0]
    assert (event["signup_count"], event["my_status"]) == (3, "waiting")

    client.post(f"/events/{world.event_id}/leave")
    event = events(client, world)[0]
    assert (event["signup_count"], event["my_status"]) == (2, "left")


# --- join and leave ---


def test_join_is_idempotent_and_rejoin_goes_to_the_back(client, world):
    others = world.waiting_users(1)
    world.user = world.new_user("Mei")
    url = f"/events/{world.event_id}"

    assert client.post(f"{url}/join").json() == {"event_id": str(world.event_id), "status": "waiting"}
    assert client.post(f"{url}/join").json()["status"] == "waiting"
    assert client.post(f"{url}/leave").json() == {"event_id": str(world.event_id), "status": "left"}
    assert client.post(f"{url}/leave").json()["status"] == "left"
    assert client.post(f"{url}/join").json()["status"] == "waiting"

    order = world.conn.execute(
        "select user_id from event_signups where event_id = %s order by created_at", (world.event_id,)
    ).fetchall()
    assert [r["user_id"] for r in order] == [others[0]["id"], world.user["id"]]


def test_unknown_event_and_not_joined(client, world):
    world.user = world.new_user("Mei")
    for method, path in [
        ("post", f"/events/{MISSING}/join"),
        ("post", f"/events/{MISSING}/leave"),
        ("post", f"/events/{MISSING}/match"),
        ("get", f"/events/{MISSING}/my-group"),
    ]:
        r = client.request(method, path)
        assert (r.status_code, r.json()) == (404, {"detail": "event not found"})

    r = client.post(f"/events/{world.event_id}/leave")
    assert (r.status_code, r.json()) == (404, {"detail": "you have not joined this event"})
    r = client.get(f"/events/{world.event_id}/my-group")
    assert (r.status_code, r.json()) == (404, {"detail": "not in a group yet"})


def test_anonymous_cannot_join(client, world):
    assert client.post(f"/events/{world.event_id}/join").status_code == 401


# --- matching ---


def test_match_forms_groups_and_saves_them(client, world):
    others = world.waiting_users(7)
    world.user = world.new_user("Mei", [world.games], ["weekend_evening"], is_student=True)
    url = f"/events/{world.event_id}"
    client.post(f"{url}/join")

    r = client.post(f"{url}/match")
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["unmatched_count"] == 0
    assert [len(g["members"]) for g in result["groups"]] == [4, 4]
    member_ids = [m["user_id"] for g in result["groups"] for m in g["members"]]
    assert sorted(member_ids) == sorted(str(u["id"]) for u in others + [world.user])
    for group in result["groups"]:
        assert group["event_id"] == str(world.event_id)
        assert group["why_you_match"] == "You all like test games, and are free on weekend evenings."
        assert group["note"]
        assert datetime.fromisoformat(group["meet_at"]) == STARTS_AT - timedelta(minutes=30)

    # The longest-waiting user starts the first group.
    assert str(others[0]["id"]) in [m["user_id"] for m in result["groups"][0]["members"]]

    mine = client.get(f"{url}/my-group").json()
    assert mine in result["groups"]
    me = next(m for m in mine["members"] if m["user_id"] == str(world.user["id"]))
    assert me == {"user_id": str(world.user["id"]), "display_name": "Mei", "is_student": True}
    assert events(client, world)[0]["my_status"] == "grouped"
    assert all(world.status_of(u) == "grouped" for u in others)

    # Nobody is waiting any more: a second match changes nothing.
    assert client.post(f"{url}/match").json() == {
        "event_id": str(world.event_id), "groups": [], "unmatched_count": 0,
    }
    assert client.get(f"{url}/my-group").json() == mine


def test_match_needs_three_people(client, world):
    world.waiting_users(1)
    world.user = world.new_user("Mei")
    url = f"/events/{world.event_id}"
    client.post(f"{url}/join")

    assert client.post(f"{url}/match").json() == {
        "event_id": str(world.event_id), "groups": [], "unmatched_count": 2,
    }
    assert world.status_of(world.user) == "waiting"
    assert client.get(f"{url}/my-group").status_code == 404


def test_match_only_touches_its_own_event(client, world):
    other_event = world.event("Other game night", world.games)
    elsewhere = world.waiting_users(3, event_id=other_event)
    world.waiting_users(3)
    world.user = world.new_user("Organiser")

    result = client.post(f"/events/{world.event_id}/match").json()
    assert [len(g["members"]) for g in result["groups"]] == [3]
    assert all(world.status_of(u, other_event) == "waiting" for u in elsewhere)


def test_people_who_left_are_not_matched(client, world):
    users = world.waiting_users(4)
    url = f"/events/{world.event_id}"
    world.user = users[0]
    client.post(f"{url}/leave")

    result = client.post(f"{url}/match").json()
    member_ids = [m["user_id"] for g in result["groups"] for m in g["members"]]
    assert sorted(member_ids) == sorted(str(u["id"]) for u in users[1:])


def test_leaving_a_big_group_keeps_it(client, world):
    users = world.waiting_users(4)
    url = f"/events/{world.event_id}"
    world.user = users[0]
    client.post(f"{url}/match")

    assert client.post(f"{url}/leave").json()["status"] == "left"
    assert client.get(f"{url}/my-group").status_code == 404
    world.user = users[1]
    group = client.get(f"{url}/my-group").json()
    assert sorted(m["user_id"] for m in group["members"]) == sorted(str(u["id"]) for u in users[1:])


def test_leaving_a_group_of_three_sends_the_others_back_to_waiting(client, world):
    users = world.waiting_users(3)
    url = f"/events/{world.event_id}"
    world.user = users[0]
    client.post(f"{url}/match")
    client.post(f"{url}/leave")

    assert [world.status_of(u) for u in users] == ["left", "waiting", "waiting"]
    world.user = users[1]
    assert client.get(f"{url}/my-group").status_code == 404
    assert events(client, world)[0]["signup_count"] == 2

    # A newcomer joins: the two who were waiting get a group again.
    world.user = world.new_user("Newcomer", [world.games])
    client.post(f"{url}/join")
    result = client.post(f"{url}/match").json()
    assert [len(g["members"]) for g in result["groups"]] == [3]
