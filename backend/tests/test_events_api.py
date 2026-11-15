"""Feature B endpoints against the real schema.

Every test runs inside one database transaction that is rolled back at the end, so
nothing is ever saved. Skipped when there is no dev database (DATABASE_URL empty,
APP_ENV not "dev", or the server cannot be reached). Needs `python db/apply_schema.py`.
"""

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from auth import caller_access, current_user
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
        self.roles = set()  # the acting user's Auth0 roles
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

    def event_row(self, event_id=None):
        return self.conn.execute(
            "select status, slot, created_by from events where id = %s",
            (event_id or self.event_id,),
        ).fetchone()

    def reports(self, count, event_id=None):
        """count open reports on the event, each from a new user."""
        for _ in range(count):
            self.user_count += 1
            reporter = self.new_user(f"reporter{self.user_count}")
            self.conn.execute(
                "insert into reports (reporter_id, event_id, reason) values (%s, %s, 'Looks fake')",
                (reporter["id"], event_id or self.event_id),
            )

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
    app.dependency_overrides[caller_access] = lambda: (
        acting_user() and {"roles": set(world.roles), "mfa": True}
    )
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
        "user_id": str(world.user["id"]),
        "display_name": "Mei",
        "is_student": True,
        "interests": [],
        "availability": [],
        "avatar_url": None,
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



# --- profile picture ---

PNG = b"\x89PNG\r\n\x1a\n" + b"\x01" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x02" * 64


def upload(client, data, name="me.png", content_type="image/png"):
    return client.put("/profile/avatar", files={"file": (name, data, content_type)})


def test_upload_shows_and_replaces_the_picture(client, world):
    mei = world.new_user("Mei")
    user_id = mei["id"]
    world.user = mei

    r = upload(client, PNG)
    assert r.status_code == 200, r.text
    first = r.json()["avatar_url"]
    assert first.startswith(f"/profile/avatar/{user_id}?v=")
    assert client.get("/profile").json()["avatar_url"] == first

    world.user = None  # the picture itself is public: an <img> tag sends no token
    r = client.get(first)
    assert r.status_code == 200
    assert r.content == PNG
    assert r.headers["content-type"] == "image/png"
    assert r.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert r.headers["x-content-type-options"] == "nosniff"

    world.user = mei
    # A new upload replaces the old one and gets a new URL; the type comes from the bytes.
    second = upload(client, JPEG, name="evil.html", content_type="text/html").json()["avatar_url"]
    assert second != first
    r = client.get(second)
    assert r.content == JPEG
    assert r.headers["content-type"] == "image/jpeg"
    count = world.conn.execute(
        "select count(*) as n from user_avatars where user_id = %s", (user_id,)
    ).fetchone()["n"]
    assert count == 1


def test_remove_picture_goes_back_to_the_mascot(client, world):
    world.user = world.new_user("Mei")
    url = upload(client, PNG).json()["avatar_url"]

    r = client.delete("/profile/avatar")
    assert r.status_code == 200
    assert r.json()["avatar_url"] is None
    r = client.get(url)
    assert r.status_code == 404
    assert r.json() == {"detail": "no profile picture"}
    assert client.delete("/profile/avatar").status_code == 200  # nothing to remove: still fine


def test_refused_upload_keeps_the_old_picture(client, world):
    world.user = world.new_user("Mei")
    url = upload(client, PNG).json()["avatar_url"]
    assert upload(client, b"GIF89a" + b"\x00" * 32).status_code == 415
    assert client.get("/profile").json()["avatar_url"] == url


def test_picture_of_an_unknown_user_is_404(client, world):
    assert client.get(f"/profile/avatar/{MISSING}").status_code == 404
    assert client.get("/profile/avatar/not-a-uuid").status_code == 422


def test_group_members_show_their_picture(client, world):
    users = world.waiting_users(3)
    world.user = users[0]
    url = upload(client, PNG).json()["avatar_url"]

    members = client.post(f"/events/{world.event_id}/match").json()["groups"][0]["members"]
    by_id = {m["user_id"]: m["avatar_url"] for m in members}
    assert by_id[str(users[0]["id"])] == url
    assert by_id[str(users[1]["id"])] is None  # no picture: the frontend draws the mascot

    mine = client.get(f"/events/{world.event_id}/my-group").json()["members"]
    assert {m["user_id"]: m["avatar_url"] for m in mine} == by_id


def test_deleting_the_user_deletes_the_picture(client, world):
    world.user = world.new_user("Mei")
    upload(client, PNG)
    world.conn.execute("delete from users where id = %s", (world.user["id"],))
    left = world.conn.execute(
        "select count(*) as n from user_avatars where user_id = %s", (world.user["id"],)
    ).fetchone()["n"]
    assert left == 0

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


def test_mine_lists_only_the_events_i_am_going_to(client, world):
    concert = world.event("Test concert", world.music)
    old = world.event("Old game night", world.games, starts_at=datetime(2020, 1, 1, tzinfo=timezone.utc))
    world.waiting_users(2)  # other people's signups never count as mine

    def mine(**params):
        r = client.get("/events", params={"mine": "true", **params})
        assert r.status_code == 200, r.text
        return [e["title"] for e in r.json()]

    world.user = world.new_user("Mei")
    assert mine() == []

    client.post(f"/events/{world.event_id}/join")
    client.post(f"/events/{concert}/join")
    world.conn.execute(
        "insert into event_signups (event_id, user_id, status) values (%s, %s, 'grouped')",
        (old, world.user["id"]),
    )
    assert mine() == ["Test concert", "Test game night"]  # upcoming only, ordered like the list
    assert mine(interest=world.music) == ["Test concert"]  # the other filters still apply
    assert "Old game night" in mine(**{"from": "2019-01-01T00:00:00Z"})

    client.post(f"/events/{concert}/leave")
    assert mine() == ["Test game night"]

    # An event taken off the list for review is hidden here too.
    world.conn.execute("update events set status = 'pending' where id = %s", (world.event_id,))
    assert mine() == []


def test_mine_needs_a_login(client, world):
    r = client.get("/events", params={"mine": "true"})
    assert r.status_code == 401
    assert r.json() == {"detail": "log in to see your events"}


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
    assert me == {
        "user_id": str(world.user["id"]),
        "display_name": "Mei",
        "is_student": True,
        "avatar_url": None,
    }
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
    world.user = world.waiting_users(3)[0]

    result = client.post(f"/events/{world.event_id}/match").json()
    assert [len(g["members"]) for g in result["groups"]] == [3]
    assert all(world.status_of(u, other_event) == "waiting" for u in elsewhere)


def test_only_people_on_the_event_can_match(client, world):
    users = world.waiting_users(3)
    url = f"/events/{world.event_id}"

    world.user = world.new_user("Stranger")  # never joined
    r = client.post(f"{url}/match")
    assert (r.status_code, r.json()) == (403, {"detail": "join this event before matching"})

    world.user = users[0]
    client.post(f"{url}/leave")  # left: no longer on the event
    assert client.post(f"{url}/match").status_code == 403
    assert all(world.status_of(u) == "waiting" for u in users[1:])  # nobody was grouped


def test_started_event_cannot_be_joined_or_matched(client, world):
    past = world.event("Yesterday's game night", world.games, starts_at=datetime(2020, 1, 1, tzinfo=timezone.utc))
    world.waiting_users(3, event_id=past)
    world.user = world.new_user("Mei")
    for path in (f"/events/{past}/join", f"/events/{past}/match"):
        r = client.post(path)
        assert (r.status_code, r.json()) == (409, {"detail": "this event has already started"})
    assert world.status_of(world.user, past) is None


def test_people_who_left_are_not_matched(client, world):
    users = world.waiting_users(4)
    url = f"/events/{world.event_id}"
    world.user = users[0]
    client.post(f"{url}/leave")

    world.user = users[1]  # someone still on the event runs the match
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


# --- community events: create, report, review ---

WED, FRI, SAT = 2, 4, 5


def local_time(weekday, hour, minute=0):
    """That weekday and time on Timișoara's clock, a month or so from now, as an ISO string."""
    day = datetime.now(ZoneInfo("Europe/Bucharest")) + timedelta(days=30)
    day += timedelta(days=(weekday - day.weekday()) % 7)
    return day.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()


NEW_EVENT = {
    "title": "  Picnic in Parcul Rozelor ",
    "venue": "Parcul Rozelor",
    "starts_at": local_time(SAT, 19),
    "description": "Bring a blanket.",
}


def create(client, world, **extra):
    return client.post("/events", json={**NEW_EVENT, "interest_slug": world.games, **extra})


def test_anonymous_cannot_create_or_report(client, world):
    assert create(client, world).status_code == 401
    r = client.post(f"/events/{world.event_id}/report", json={"reason": "Looks fake"})
    assert r.status_code == 401


def test_a_student_creates_an_event_that_is_listed_at_once(client, world):
    world.user = world.new_user("Mei", is_student=True)
    r = create(client, world)
    assert r.status_code == 201, r.text
    event = r.json()
    assert event["title"] == "Picnic in Parcul Rozelor"
    assert event["slot"] == "weekend_evening"
    assert event["interest"]["slug"] == world.games
    assert (event["status"], event["created_by_me"], event["signup_count"]) == ("active", True, 0)
    assert world.event_row(event["id"])["created_by"] == world.user["id"]

    world.user = None
    listed = {e["id"]: e for e in events(client, world)}
    assert listed[event["id"]]["created_by_me"] is False


def test_slot_comes_from_the_local_start_time(client, world):
    world.user = world.new_user("Mei", is_student=True)
    world.roles = {"creator"}  # four events: more than the daily limit
    assert create(client, world, starts_at=local_time(WED, 11)).json()["slot"] == "weekday_morning"
    # 13:00 on a weekday: there is no weekday afternoon slot.
    assert create(client, world, starts_at=local_time(WED, 13)).json()["slot"] == "weekday_evening"
    assert create(client, world, starts_at=local_time(SAT, 13)).json()["slot"] == "weekend_afternoon"
    # Half past midnight on Saturday in Timișoara is still Friday in UTC: the local day counts.
    late = datetime.fromisoformat(local_time(SAT, 0, 30)).astimezone(timezone.utc)
    assert late.weekday() == FRI
    assert create(client, world, starts_at=late.isoformat()).json()["slot"] == "weekend_morning"


def test_a_new_user_s_event_waits_for_review(client, world):
    world.user = world.new_user("Newcomer")
    event = create(client, world).json()
    assert event["status"] == "pending"
    # The creator sees it, nobody else does, and nobody can join it.
    assert event["id"] in [e["id"] for e in events(client, world)]
    r = client.post(f"/events/{event['id']}/join")
    assert (r.status_code, r.json()) == (409, {"detail": "this event is not open right now"})
    world.user = world.new_user("Other")
    assert event["id"] not in [e["id"] for e in events(client, world)]
    world.user = None
    assert event["id"] not in [e["id"] for e in events(client, world)]


def test_someone_who_went_out_with_a_group_is_trusted(client, world):
    user = world.new_user("Regular")
    past = world.event("Last week", world.games, starts_at=datetime.now(timezone.utc) - timedelta(days=7))
    world.conn.execute(
        "insert into event_signups (event_id, user_id, status) values (%s, %s, 'grouped')",
        (past, user["id"]),
    )
    world.user = user
    assert create(client, world).json()["status"] == "active"


def test_create_rejects_bad_input(client, world):
    world.user = world.new_user("Mei", is_student=True)
    r = create(client, world, starts_at="2020-01-01T10:00:00Z")
    assert (r.status_code, r.json()) == (422, {"detail": "the event must start in the future"})
    far = (datetime.now(timezone.utc) + timedelta(days=400)).isoformat()
    r = create(client, world, starts_at=far)
    assert (r.status_code, r.json()) == (422, {"detail": "the event must start within a year"})
    r = create(client, world, interest_slug="no_such_thing")
    assert (r.status_code, r.json()) == (422, {"detail": "unknown interest: no_such_thing"})
    assert create(client, world, title="  a ").status_code == 422
    no_timezone = NEW_EVENT["starts_at"][:19]
    assert create(client, world, starts_at=no_timezone).status_code == 422
    assert create(client, world, interest_slug=None, description=None).status_code == 201


def test_daily_creation_limit(client, world, monkeypatch):
    monkeypatch.setattr(settings, "EVENT_CREATE_DAILY_LIMIT", 2)
    world.user = world.new_user("Mei", is_student=True)
    assert create(client, world).status_code == 201
    assert create(client, world).status_code == 201
    r = create(client, world)
    assert r.status_code == 429
    assert r.json() == {"detail": "you can create 2 events a day, try again tomorrow"}

    # The limit is per user, and events older than 24 hours do not count.
    other = world.new_user("Other")
    mei, world.user = world.user, other
    assert create(client, world).status_code == 201
    world.conn.execute(
        "update events set created_at = now() - interval '25 hours' where created_by = %s",
        (mei["id"],),
    )
    world.user = mei
    assert create(client, world).status_code == 201


@pytest.mark.parametrize("role", ["creator", "moderator", "admin"])
def test_staff_roles_have_no_limit_and_no_review(client, world, monkeypatch, role):
    monkeypatch.setattr(settings, "EVENT_CREATE_DAILY_LIMIT", 1)
    world.user = world.new_user("Organiser")
    world.roles = {role}
    for _ in range(3):
        r = create(client, world)
        assert r.status_code == 201, r.text
        assert r.json()["status"] == "active"


def test_report_is_saved_once_per_user(client, world):
    world.user = world.new_user("Mei")
    url = f"/events/{world.event_id}/report"
    r = client.post(url, json={"reason": "  This is an advert, not an event. "})
    assert r.status_code == 201, r.text
    assert r.json() == {"event_id": str(world.event_id), "status": "received"}
    row = world.conn.execute(
        "select reporter_id, reason, status from reports where event_id = %s", (world.event_id,)
    ).fetchone()
    assert row == {
        "reporter_id": world.user["id"],
        "reason": "This is an advert, not an event.",
        "status": "open",
    }

    r = client.post(url, json={"reason": "Reporting again"})
    assert (r.status_code, r.json()) == (409, {"detail": "you have already reported this event"})
    assert client.post(url, json={"reason": "no"}).status_code == 422
    assert client.post(f"/events/{MISSING}/report", json={"reason": "Looks fake"}).status_code == 404
    assert world.event_row()["status"] == "active"


def test_cannot_report_your_own_event(client, world):
    world.user = world.new_user("Mei", is_student=True)
    event = create(client, world).json()
    r = client.post(f"/events/{event['id']}/report", json={"reason": "Looks fake"})
    assert (r.status_code, r.json()) == (409, {"detail": "you cannot report your own event"})


def test_more_than_ten_reports_take_the_event_off_the_list(client, world):
    world.reports(9)
    url = f"/events/{world.event_id}"
    world.user = world.new_user("Tenth")
    assert client.post(f"{url}/report", json={"reason": "Looks fake"}).status_code == 201
    assert world.event_row()["status"] == "active"  # 10 reports: still listed
    assert [e["id"] for e in events(client, world)] == [str(world.event_id)]

    world.user = world.new_user("Eleventh")
    assert client.post(f"{url}/report", json={"reason": "Looks fake"}).status_code == 201
    assert world.event_row()["status"] == "pending"
    assert events(client, world) == []
    assert client.post(f"{url}/join").status_code == 409
    world.user = world.new_user("Twelfth")
    r = client.post(f"{url}/report", json={"reason": "Looks fake"})
    assert (r.status_code, r.json()) == (409, {"detail": "this event is not open right now"})


def test_creator_removes_their_own_event(client, world):
    world.user = world.new_user("Mei", is_student=True)
    event = create(client, world).json()
    world.waiting_users(3, event_id=event["id"])
    client.post(f"/events/{event['id']}/join")
    client.post(f"/events/{event['id']}/match")
    world.reports(1, event["id"])

    r = client.delete(f"/events/{event['id']}")
    assert (r.status_code, r.content) == (204, b"")
    assert event["id"] not in [e["id"] for e in events(client, world)]
    assert client.delete(f"/events/{event['id']}").status_code == 404
    # Signups and groups went with it; the report stays, closed, without its event.
    left = world.conn.execute(
        """
        select (select count(*) from event_signups where event_id = %(id)s) as signups,
               (select count(*) from event_groups where event_id = %(id)s) as groups
        """,
        {"id": event["id"]},
    ).fetchone()
    assert left == {"signups": 0, "groups": 0}
    report = world.conn.execute(
        "select event_id, status, resolved_by from reports where reporter_id = "
        "(select id from users where auth0_sub = %s)",
        (f"test|{world.tag}|reporter{world.user_count}",),
    ).fetchone()
    assert report == {"event_id": None, "status": "actioned", "resolved_by": world.user["id"]}


def test_only_the_creator_or_a_moderator_removes_an_event(client, world):
    forbidden = (403, {"detail": "only the creator or a moderator can remove this event"})
    url = f"/events/{world.event_id}"  # a seeded event: nobody created it
    assert client.delete(url).status_code == 401

    world.user = world.new_user("Mei", is_student=True)
    r = client.delete(url)
    assert (r.status_code, r.json()) == forbidden
    mine = create(client, world).json()

    world.user, world.roles = world.new_user("Organiser"), {"creator"}
    for path in (url, f"/events/{mine['id']}"):  # the creator role only covers your own events
        r = client.delete(path)
        assert (r.status_code, r.json()) == forbidden
    assert world.event_row() is not None and world.event_row(mine["id"]) is not None

    r = client.delete(f"/events/{MISSING}")
    assert (r.status_code, r.json()) == (404, {"detail": "event not found"})


@pytest.mark.parametrize("role", ["moderator", "admin"])
def test_moderators_and_admins_remove_any_event(client, world, role):
    world.user = world.new_user("Newcomer")
    pending = create(client, world).json()  # hidden from everyone else, still removable

    world.user, world.roles = world.new_user("Staff"), {role}
    for event_id in (world.event_id, pending["id"]):
        assert client.delete(f"/events/{event_id}").status_code == 204
        assert world.event_row(event_id) is None


def test_admin_without_mfa_cannot_remove(client, world):
    world.user, world.roles = world.new_user("Admin"), {"admin"}
    app.dependency_overrides[caller_access] = lambda: {"roles": {"admin"}, "mfa": False}
    assert client.delete(f"/events/{world.event_id}").status_code == 403
    assert world.event_row() is not None


def test_started_event_cannot_be_removed(client, world):
    past = world.event("Yesterday's game night", world.games, starts_at=datetime(2020, 1, 1, tzinfo=timezone.utc))
    world.user, world.roles = world.new_user("Moderator"), {"moderator"}
    r = client.delete(f"/events/{past}")
    assert (r.status_code, r.json()) == (409, {"detail": "this event has already started"})
    assert world.event_row(past) is not None


def test_people_on_a_hidden_event_can_still_leave(client, world):
    users = world.waiting_users(3)
    world.user = users[0]
    client.post(f"/events/{world.event_id}/match")
    world.conn.execute("update events set status = 'pending' where id = %s", (world.event_id,))

    assert client.post(f"/events/{world.event_id}/match").status_code == 409
    assert client.get(f"/events/{world.event_id}/my-group").status_code == 200
    assert client.post(f"/events/{world.event_id}/leave").json()["status"] == "left"


def test_review_queue_needs_a_moderator(client, world):
    world.user = world.new_user("Mei", is_student=True)
    world.roles = {"creator"}
    for call in (
        lambda: client.get("/moderation/events"),
        lambda: client.post(f"/moderation/events/{world.event_id}/approve"),
        lambda: client.post(f"/moderation/events/{world.event_id}/reject"),
    ):
        r = call()
        assert (r.status_code, r.json()) == (403, {"detail": "you do not have permission to do this"})
    world.user = None
    assert client.get("/moderation/events").status_code == 401


def queue(client, world):
    """This test's events in the review queue."""
    r = client.get("/moderation/events")
    assert r.status_code == 200, r.text
    return [e for e in r.json() if e["interest"] and e["interest"]["slug"] == world.games]


def test_review_queue_lists_pending_and_reported_events(client, world):
    newcomer = world.new_user("Newcomer")
    world.user = newcomer
    pending = create(client, world).json()
    world.reports(2)  # on world.event_id, which stays active
    quiet = world.event("Nothing to see", world.games)
    past = world.event("Last week", world.games, starts_at=datetime.now(timezone.utc) - timedelta(days=7))
    world.reports(1, past)

    world.user = world.new_user("Moderator")
    world.roles = {"moderator"}
    listed = queue(client, world)
    assert [e["id"] for e in listed] == [pending["id"], str(world.event_id)]  # pending first
    assert str(quiet) not in [e["id"] for e in listed]

    first, second = listed
    assert first["status"] == "pending" and first["reports"] == []
    assert first["created_by"] == {"user_id": str(newcomer["id"]), "display_name": "Newcomer"}
    assert second["status"] == "active" and second["created_by"] is None
    assert [r["reason"] for r in second["reports"]] == ["Looks fake", "Looks fake"]
    assert all(r["reporter_name"].startswith("reporter") for r in second["reports"])


def test_approve_publishes_and_dismisses_the_reports(client, world):
    world.reports(11)
    world.conn.execute("update events set status = 'pending' where id = %s", (world.event_id,))
    moderator = world.new_user("Moderator")
    world.user, world.roles = moderator, {"admin"}

    r = client.post(f"/moderation/events/{world.event_id}/approve")
    assert r.status_code == 200, r.text
    assert r.json() == {"event_id": str(world.event_id), "status": "active"}
    assert queue(client, world) == []
    rows = world.conn.execute(
        "select distinct status, resolved_by, resolved_at is not null as resolved from reports"
        " where event_id = %s",
        (world.event_id,),
    ).fetchall()
    assert rows == [{"status": "dismissed", "resolved_by": moderator["id"], "resolved": True}]

    # Back on the list; dismissed reports no longer count towards hiding it.
    world.user, world.roles = world.new_user("Mei"), set()
    assert [e["id"] for e in events(client, world)] == [str(world.event_id)]
    r = client.post(f"/events/{world.event_id}/report", json={"reason": "Still looks fake"})
    assert r.status_code == 201
    assert world.event_row()["status"] == "active"


def test_reject_removes_the_event(client, world):
    creator = world.new_user("Newcomer")
    world.user = creator
    event = create(client, world).json()
    world.reports(1, event["id"])

    world.user, world.roles = world.new_user("Moderator"), {"moderator"}
    r = client.post(f"/moderation/events/{event['id']}/reject")
    assert r.json() == {"event_id": event["id"], "status": "rejected"}
    assert queue(client, world) == []
    assert client.post(f"/moderation/events/{MISSING}/reject").status_code == 404
    status = world.conn.execute(
        "select status from reports where event_id = %s", (event["id"],)
    ).fetchone()["status"]
    assert status == "actioned"

    # Only the creator still sees it, marked as removed.
    world.roles = set()
    assert event["id"] not in [e["id"] for e in events(client, world)]
    world.user = creator
    mine = {e["id"]: e for e in events(client, world)}
    assert mine[event["id"]]["status"] == "rejected"
