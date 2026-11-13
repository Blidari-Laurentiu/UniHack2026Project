"""Person A: seed rental listings. Sample data, not real listings.

About 200 listings across 10 Timișoara neighbourhoods, 1 to 3 rooms, with prices drawn
from the ranges in data/rent_ranges.md and listed_at spread over the last 12 months.

Prices drift up over the year (about +8% year on year, as Storia reported for Timișoara),
so older listings are a little cheaper. That gives the price-trend chart something to show.

Safe to run again: the listings table holds only seed data, so its rows are deleted and
re-inserted. With random.seed(42) the prices and areas are the same on every laptop;
listed_at is relative to today, so the last 12 months always have data.
"""
import random
from datetime import datetime, timedelta, timezone

# Neighbourhood -> (min, max) asking rent in EUR per room count. From data/rent_ranges.md.
RANGES = {
    "Centru": {1: (330, 450), 2: (480, 700), 3: (600, 900)},
    "Elisabetin": {1: (300, 400), 2: (430, 600), 3: (550, 780)},
    "Circumvalațiunii": {1: (300, 400), 2: (420, 580), 3: (520, 720)},
    "Iosefin": {1: (280, 380), 2: (400, 550), 3: (500, 700)},
    "Fabric": {1: (260, 360), 2: (380, 520), 3: (480, 650)},
    "Complex Studențesc": {1: (220, 350), 2: (380, 520), 3: (480, 650)},
    "Girocului": {1: (280, 380), 2: (400, 550), 3: (500, 700)},
    "Tipografilor": {1: (270, 360), 2: (400, 540), 3: (500, 680)},
    "Dâmbovița": {1: (260, 350), 2: (380, 500), 3: (470, 620)},
    "Calea Șagului": {1: (250, 330), 2: (360, 480), 3: (450, 600)},
}

# How much of the market each neighbourhood and room count gets, for the extra listings.
NEIGHBOURHOOD_WEIGHT = {
    "Complex Studențesc": 3, "Centru": 2, "Circumvalațiunii": 2, "Elisabetin": 2, "Fabric": 2,
    "Iosefin": 2, "Girocului": 1, "Tipografilor": 1, "Dâmbovița": 1, "Calea Șagului": 1,
}
ROOMS_WEIGHT = {1: 3, 2: 4, 3: 2}

AREA_M2 = {1: (26, 40), 2: (44, 65), 3: (62, 90)}

TOTAL = 200
BASE_PER_CELL = 5  # pricing needs 5 listings for a neighbourhood-level median
# Thin on purpose, so the demo can show the city-wide fallback.
THIN_CELLS = {("Calea Șagului", 3): 3}

YEARLY_GROWTH = 0.08
DAYS = 365


def cell_counts(rng: random.Random) -> dict[tuple[str, int], int]:
    counts = {
        (n, r): THIN_CELLS.get((n, r), BASE_PER_CELL) for n in RANGES for r in ROOMS_WEIGHT
    }
    cells = [c for c in counts if c not in THIN_CELLS]
    weights = [NEIGHBOURHOOD_WEIGHT[n] * ROOMS_WEIGHT[r] for n, r in cells]
    for cell in rng.choices(cells, weights=weights, k=TOTAL - sum(counts.values())):
        counts[cell] += 1
    return counts


def build_listings(now: datetime, rng: random.Random) -> list[tuple]:
    rows = []
    for (neighbourhood, rooms), count in sorted(cell_counts(rng).items()):
        low, high = RANGES[neighbourhood][rooms]
        for _ in range(count):
            age_days = rng.uniform(0, DAYS - 5)  # stays inside a 12-month window
            # Today's range; a listing from a year ago was about 8% cheaper.
            price = rng.triangular(low, high) * (1 - YEARLY_GROWTH * age_days / DAYS)
            price = round(price / 5) * 5
            area = round(rng.uniform(*AREA_M2[rooms]))
            listed_at = (now - timedelta(days=age_days)).replace(microsecond=0)
            rows.append((neighbourhood, rooms, price, area, listed_at))
    return rows


def seed(conn) -> None:
    random.seed(42)
    rng = random.Random(42)
    rows = build_listings(datetime.now(timezone.utc), rng)
    with conn.cursor() as cur:
        cur.execute("delete from listings")
        cur.executemany(
            "insert into listings (neighbourhood, rooms, price_eur, area_m2, listed_at)"
            " values (%s, %s, %s, %s, %s)",
            rows,
        )
    print(f"seed_listings: {len(rows)} sample listings in {len(RANGES)} neighbourhoods")
