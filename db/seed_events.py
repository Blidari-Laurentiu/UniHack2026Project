"""Person B: seed interests, events, fake users and signups. Sample data, not real listings.

Safe to run again: interests, events and fake users are upserted on stable keys, and the
signups and groups of the seeded events are reset, so the demo always starts clean.
Event dates are relative to today, so the list always shows upcoming events.
"""
import random
import uuid
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

NAMESPACE = uuid.UUID("6f1f5e0a-7c1b-4d43-9a57-0d2a1c5b8e11")
# Timișoara local time with daylight saving (UTC+2 in winter, UTC+3 in summer), so a 19:00
# event is 19:00 on the wall clock all year. Needs the tzdata package on Windows.
EET = ZoneInfo("Europe/Bucharest")
SLOTS = ["weekday_morning", "weekday_evening", "weekend_morning", "weekend_afternoon", "weekend_evening"]

INTERESTS = [
    ("theatre", "Theatre"),
    ("live_music", "Live music"),
    ("board_games", "Board games"),
    ("football", "Football"),
    ("hiking", "Hiking"),
    ("language_exchange", "Language exchange"),
    ("cinema", "Cinema"),
    ("food_drinks", "Food and drinks"),
    ("art_museums", "Art and museums"),
    ("cycling", "Cycling"),
]

MON, TUE, WED, THU, FRI, SAT, SUN = range(7)

# (key, title, venue, interest, weekday, hour, minute, weeks ahead, description)
# Weekday events are in the morning or the evening: there is no weekday afternoon slot.
EVENTS = [
    ("boardgames-1", "Board-game night", "Scârț Loc Lejer", "board_games", WED, 19, 0, 0,
     "Catan, Dixit and Codenames. Beginners welcome, games explained in English."),
    ("hamlet", "Hamlet (with English surtitles)", "Teatrul Național Timișoara", "theatre", SAT, 19, 0, 0,
     "Classic production with English surtitles. About three hours with a break."),
    ("football-1", "Poli Timișoara home match", "Stadionul Dan Păltinișanu", "football", SUN, 15, 0, 0,
     "Liga 2 home game. Meet at the main gate, tickets at the stadium."),
    ("tandem-1", "Romanian-English language tandem", "La Două Bufnițe", "language_exchange", TUE, 18, 30, 0,
     "Half an hour in Romanian, half an hour in English. All levels."),
    ("jazz-1", "Jazz jam session", "Aethernativ", "live_music", THU, 20, 30, 0,
     "Open jam session. Bring an instrument or just listen."),
    ("hike-1", "Day hike to Șiria fortress", "Meet at Gara de Nord", "hiking", SAT, 8, 0, 0,
     "Easy 10 km walk with a view over the Arad vineyards. Train there and back."),
    ("film-1", "European film night", "Cinema Victoria", "cinema", FRI, 19, 30, 0,
     "Award-winning European film with English subtitles."),
    ("art-1", "Guided tour: Brâncuși and the Banat collection", "Muzeul Național de Artă", "art_museums", SUN, 11, 0, 0,
     "One-hour guided tour in English in the Baroque Palace."),
    ("ride-1", "Sunday ride along the Bega", "Podul Michelangelo", "cycling", SUN, 10, 0, 0,
     "Flat 25 km ride on the Bega bike path towards the Serbian border. City bikes are fine."),
    ("food-1", "Banat food market tour", "Piața Badea Cârțan", "food_drinks", SAT, 10, 0, 0,
     "Taste local cheese, zacuscă and langoși with someone who knows the stalls."),
    ("phil-1", "Banatul Philharmonic: symphonic evening", "Filarmonica Banatul", "live_music", FRI, 19, 0, 0,
     "Dvořák and Enescu. Student tickets at the door."),
    ("coffee-1", "Newcomers coffee morning", "Ovride Specialty Coffee", "language_exchange", WED, 9, 30, 1,
     "Informal coffee for people who just moved to Timișoara."),
    ("boardgames-2", "Strategy board-game evening", "Scârț Loc Lejer", "board_games", MON, 19, 0, 1,
     "Longer games: Terraforming Mars, Wingspan, Brass."),
    ("german-theatre", "German State Theatre: contemporary play", "Teatrul German de Stat", "theatre", THU, 19, 30, 1,
     "Performed in German with Romanian and English surtitles."),
    ("fivea-side", "Five-a-side football, mixed level", "Baza Sportivă Politehnica", "football", TUE, 19, 0, 1,
     "Friendly game on artificial turf. Bring indoor or turf shoes."),
    ("hike-2", "Autumn walk in Pădurea Verde", "Muzeul Satului Bănățean", "hiking", SUN, 10, 30, 1,
     "Two-hour forest walk, then a look at the village museum."),
    ("film-2", "Romanian New Wave screening and talk", "Cinema Timiș", "cinema", SAT, 17, 30, 1,
     "Romanian film with English subtitles and a short discussion after."),
    ("wine-1", "Wines of Recaș tasting", "Vinoteca Enoteca de Savoya", "food_drinks", FRI, 18, 30, 1,
     "Five local wines with a short introduction to the Banat wine region."),
    ("gig-1", "Indie gig night", "Capcana", "live_music", SAT, 21, 0, 1,
     "Two local bands. Doors at 20:00."),
    ("art-2", "Gallery walk in Fabric", "FABER", "art_museums", SAT, 15, 0, 1,
     "Three small galleries and a former oil factory turned culture hub."),
    ("ride-2", "Morning ride to Pădurea Verde", "Piața Victoriei", "cycling", SAT, 9, 0, 1,
     "Easy 15 km loop, coffee stop at the end."),
    ("tandem-2", "Language exchange evening", "Reciproca", "language_exchange", THU, 18, 30, 2,
     "Tables for Romanian, English, German, Spanish and Serbian."),
    ("boardgames-3", "Party games night", "Jocozaur board-game café", "board_games", FRI, 19, 0, 2,
     "Short, loud games in big groups. No experience needed."),
    ("opera-1", "Opera night: La Traviata", "Opera Națională Română Timișoara", "theatre", SUN, 18, 0, 2,
     "Verdi in Italian with Romanian surtitles. Standing tickets are cheap."),
    ("football-2", "Watch party: national team", "The 80's Pub", "football", TUE, 20, 45, 2,
     "Big screen, the match starts at 21:45."),
    ("cooking-1", "Cook sarmale together", "Ambasada", "food_drinks", SUN, 13, 0, 2,
     "Hands-on cooking session, then we eat what we made."),
]

NAMES = [
    "Andrei", "Ioana", "Lucía", "Mateusz", "Aiko", "Bogdan", "Chiara", "Darius", "Elif", "Farah",
    "Gabriel", "Hana", "Ilinca", "Jonas", "Katya", "Liam", "Maria", "Nikola", "Oana", "Pedro",
    "Quynh", "Raluca", "Sami", "Teodora", "Uma", "Vlad", "Wei", "Xenia", "Yusuf", "Zsófia",
    "Alexandru", "Bianca", "Cosmin", "Daria", "Emre", "Flavia",
]

# (event key, number of waiting fake users). One more person joining gives a clean match:
# 7 + 1 = two groups of 4, 11 + 1 = three groups of 4, 4 + 1 = one group of 5.
DEMO_SIGNUPS = [("boardgames-1", 7), ("hamlet", 11), ("football-1", 4)]


def event_id(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"event:{key}")


def slot_for(starts_at: datetime) -> str:
    part = "morning" if starts_at.hour < 12 else "afternoon" if starts_at.hour < 17 else "evening"
    if starts_at.weekday() >= SAT:
        return f"weekend_{part}"
    return "weekday_morning" if part == "morning" else "weekday_evening"


def next_date(today, weekday: int, weeks_ahead: int):
    """First date after today that falls on weekday, plus whole weeks."""
    days = (weekday - today.weekday() - 1) % 7 + 1
    return today + timedelta(days=days + 7 * weeks_ahead)


def seed(conn) -> None:
    rng = random.Random(42)
    now = datetime.now(EET)

    # Interests
    interest_ids = {}
    for slug, label in INTERESTS:
        interest_ids[slug] = conn.execute(
            "insert into interests (slug, label) values (%s, %s) "
            "on conflict (slug) do update set label = excluded.label returning id",
            (slug, label),
        ).fetchone()[0]

    # Events
    starts = {}
    for key, title, venue, interest, weekday, hour, minute, weeks, description in EVENTS:
        starts_at = datetime.combine(next_date(now.date(), weekday, weeks), time(hour, minute), EET)
        starts[key] = starts_at
        conn.execute(
            """
            insert into events (id, title, venue, starts_at, slot, interest_id, description)
            values (%s, %s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
                title = excluded.title, venue = excluded.venue, starts_at = excluded.starts_at,
                slot = excluded.slot, interest_id = excluded.interest_id,
                description = excluded.description
            """,
            (event_id(key), title, venue, starts_at, slot_for(starts_at), interest_ids[interest], description),
        )

    # Fake users with interests and availability
    slugs = [slug for slug, _ in INTERESTS]
    users = []
    for i, name in enumerate(NAMES, start=1):
        user_id = conn.execute(
            "insert into users (auth0_sub, display_name, is_student) values (%s, %s, %s) "
            "on conflict (auth0_sub) do update set display_name = excluded.display_name, "
            "is_student = excluded.is_student returning id",
            (f"seed|{i:02d}", name, rng.random() < 0.7),
        ).fetchone()[0]
        user = {
            "id": user_id,
            "interests": rng.sample(slugs, rng.randint(2, 4)),
            "availability": rng.sample(SLOTS, rng.randint(1, 3)),
        }
        users.append(user)
        conn.execute("delete from user_interests where user_id = %s", (user_id,))
        conn.execute("delete from user_availability where user_id = %s", (user_id,))
        for slug in user["interests"]:
            conn.execute(
                "insert into user_interests (user_id, interest_id) values (%s, %s)",
                (user_id, interest_ids[slug]),
            )
        for slot in user["availability"]:
            conn.execute(
                "insert into user_availability (user_id, slot) values (%s, %s)", (user_id, slot)
            )

    # Signups: reset the seeded events, then fill them again.
    seeded = [event_id(e[0]) for e in EVENTS]
    conn.execute("delete from event_groups where event_id = any(%s)", (seeded,))
    conn.execute("delete from event_signups where event_id = any(%s)", (seeded,))

    interest_of = {e[0]: e[3] for e in EVENTS}
    demo = dict(DEMO_SIGNUPS)
    signups = 0
    for key in interest_of:
        count = demo.get(key, rng.randint(0, 2))
        # People who like this kind of event sign up first.
        fans = [u for u in users if interest_of[key] in u["interests"]]
        others = [u for u in users if interest_of[key] not in u["interests"]]
        rng.shuffle(fans)
        rng.shuffle(others)
        for n, user in enumerate((fans + others)[:count]):
            conn.execute(
                "insert into event_signups (event_id, user_id, status, created_at) "
                "values (%s, %s, 'waiting', %s)",
                (event_id(key), user["id"], now - timedelta(hours=48) + timedelta(minutes=7 * n)),
            )
            signups += 1

    print(
        f"seed_events: {len(INTERESTS)} interests, {len(EVENTS)} events, "
        f"{len(users)} fake users, {signups} waiting signups"
    )
