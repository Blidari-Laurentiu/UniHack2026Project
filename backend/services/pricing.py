"""Feature A (Person A): price verdict against the listings table.

The verdict compares the rent with the median asking rent for the same room count over the
last 12 months: in the neighbourhood when it has at least MIN_SAMPLE listings, otherwise
city-wide. Pure verdict logic is separate from the SQL so it can be tested without a database.
"""

from psycopg.rows import dict_row

from schemas.lease import NeighbourhoodStat, PriceVerdict

MIN_SAMPLE = 5  # fewer listings than this in the neighbourhood -> city-wide median
FAIR_BAND_PCT = 10.0  # within ±10% of the median is fair
SCAM_BELOW_PCT = -30.0  # more than 30% under the median is suspicious
WINDOW = "12 months"


class PricingUnavailable(Exception):
    """No listings at all for this room count, even city-wide."""


def verdict_for(diff_pct: float) -> str:
    if diff_pct < SCAM_BELOW_PCT:
        return "suspiciously_low"
    if diff_pct < -FAIR_BAND_PCT:
        return "below_market"
    if diff_pct > FAIR_BAND_PCT:
        return "above_market"
    return "fair"


def make_verdict(rent_eur: float, median_eur: float, scope: str, sample_size: int) -> PriceVerdict:
    diff_pct = (rent_eur - median_eur) / median_eur * 100
    return PriceVerdict(
        median_eur=round(median_eur, 2),
        diff_pct=round(diff_pct, 1),
        verdict=verdict_for(diff_pct),
        scope=scope,
        sample_size=sample_size,
    )


# One round trip: the neighbourhood and the city-wide median together.
MEDIAN_SQL = f"""
select
    count(*) filter (where lower(neighbourhood) = lower(%(neighbourhood)s)) as local_count,
    percentile_cont(0.5) within group (order by price_eur)
        filter (where lower(neighbourhood) = lower(%(neighbourhood)s))  as local_median,
    count(*)                                                             as city_count,
    percentile_cont(0.5) within group (order by price_eur)               as city_median
from listings
where rooms = %(rooms)s
  and listed_at >= now() - interval '{WINDOW}'
"""


def price_verdict(conn, neighbourhood: str, rooms: int, rent_eur: float) -> PriceVerdict:
    """Raises PricingUnavailable when there is no listing for this room count."""
    with conn.cursor(row_factory=dict_row) as cur:
        row = cur.execute(MEDIAN_SQL, {"neighbourhood": neighbourhood, "rooms": rooms}).fetchone()
    if row["local_count"] >= MIN_SAMPLE:
        return make_verdict(rent_eur, float(row["local_median"]), "neighbourhood", row["local_count"])
    if row["city_count"] > 0:
        return make_verdict(rent_eur, float(row["city_median"]), "city", row["city_count"])
    raise PricingUnavailable(f"no listings with {rooms} rooms to compare with")


STATS_SQL = f"""
select neighbourhood, rooms, count(*) as n,
       percentile_cont(0.5) within group (order by price_eur) as median
from listings
where listed_at >= now() - interval '{WINDOW}'
group by neighbourhood, rooms
order by neighbourhood, rooms
"""


def neighbourhood_stats(conn) -> list[NeighbourhoodStat]:
    """Median per neighbourhood and room count, for the dropdown and the median chart."""
    stats: dict[str, NeighbourhoodStat] = {}
    with conn.cursor(row_factory=dict_row) as cur:
        for row in cur.execute(STATS_SQL):
            stat = stats.setdefault(
                row["neighbourhood"],
                NeighbourhoodStat(name=row["neighbourhood"], median_eur_by_rooms={}, sample_size=0),
            )
            stat.median_eur_by_rooms[row["rooms"]] = round(float(row["median"]), 2)
            stat.sample_size += row["n"]
    return list(stats.values())
