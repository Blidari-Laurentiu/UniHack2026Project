"""Feature A (Person A): price verdict against the listings table.

The verdict compares the rent with the median asking rent for the same room count over the
last 12 months: in the neighbourhood when it has at least MIN_SAMPLE listings, otherwise
city-wide. Pure verdict logic is separate from the SQL so it can be tested without a database.
"""

from psycopg.rows import dict_row, tuple_row

from schemas.lease import NeighbourhoodStat, PriceVerdict, TrendPoint

MIN_SAMPLE = 5  # fewer listings than this in the neighbourhood -> city-wide median
FAIR_BAND_PCT = 10.0  # within ±10% of the median is fair
SCAM_BELOW_PCT = -30.0  # more than 30% under the median is suspicious
WINDOW = "12 months"


class PricingUnavailable(Exception):
    """No listings at all for this room count, even city-wide.

    The request model allows only 1 to 3 rooms (schemas.lease.MAX_ROOMS), which the seed
    covers, so this means the listings table is empty: the seed was not run. Routers turn it
    into a 503 with {"detail": "..."}.
    """


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


# ---------- price trend ----------
#
# Monthly median rent over the last TREND_MONTHS calendar months (the current one included),
# in UTC months. With TimescaleDB the points come from the continuous aggregates
# listings_monthly / listings_monthly_city (db/schema/10_lease.sql); their current month is
# real-time, so new listings count straight away. On plain Postgres the same shape is
# computed from listings with date_trunc.

TREND_MONTHS = 12
TREND_VIEWS = ("listings_monthly", "listings_monthly_city")
_CUTOFF = (
    f"(date_trunc('month', now() at time zone 'UTC') - interval '{TREND_MONTHS - 1} months')"
    " at time zone 'UTC'"
)
_HOOD_FILTER = "and lower(neighbourhood) = lower(%(neighbourhood)s)"


def trend_sql(city: bool, aggregate: bool) -> str:
    """SQL for the trend points: month (date), median_eur, n. Oldest month first."""
    hood = "" if city else _HOOD_FILTER
    if aggregate:
        view = "listings_monthly_city" if city else "listings_monthly"
        return f"""
select (bucket at time zone 'UTC')::date as month, median_eur, listing_count as n
from {view}
where rooms = %(rooms)s {hood}
  and bucket >= {_CUTOFF}
order by bucket
"""
    return f"""
select (date_trunc('month', listed_at, 'UTC') at time zone 'UTC')::date as month,
       percentile_cont(0.5) within group (order by price_eur) as median_eur,
       count(*) as n
from listings
where rooms = %(rooms)s {hood}
  and listed_at >= {_CUTOFF}
group by 1
order by 1
"""


def to_points(rows) -> list[TrendPoint]:
    """Rows (month, median_eur, n) -> points, oldest first, medians to the cent."""
    points = [
        TrendPoint(month=r["month"], median_eur=round(float(r["median_eur"]), 2), count=r["n"])
        for r in rows
        if r["n"]
    ]
    return sorted(points, key=lambda p: p.month)


_aggregate_seen = False  # once the views exist they stay, so only a "yes" is remembered


def has_trend_aggregate(conn) -> bool:
    """True when both continuous aggregates exist (TimescaleDB and schema applied)."""
    global _aggregate_seen
    if not _aggregate_seen:
        # to_regclass also works on plain Postgres, where it returns null.
        with conn.cursor(row_factory=tuple_row) as cur:
            (_aggregate_seen,) = cur.execute(
                "select to_regclass(%s) is not null and to_regclass(%s) is not null", TREND_VIEWS
            ).fetchone()
    return _aggregate_seen


def price_trend(conn, rooms: int, neighbourhood: str | None = None) -> tuple[list[TrendPoint], str]:
    """Monthly medians for a room count, in a neighbourhood or city-wide (None or blank).

    Returns (points, source) where source is "continuous_aggregate" or "listings".
    An unknown neighbourhood gives no points; that is not an error.
    """
    city = not (neighbourhood and neighbourhood.strip())
    aggregate = has_trend_aggregate(conn)
    params = {"rooms": rooms, "neighbourhood": None if city else neighbourhood.strip()}
    with conn.cursor(row_factory=dict_row) as cur:
        rows = cur.execute(trend_sql(city, aggregate), params).fetchall()
    return to_points(rows), "continuous_aggregate" if aggregate else "listings"
