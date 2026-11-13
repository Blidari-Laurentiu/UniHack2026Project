// Person A: the SQL shown in "How this was checked", as static text.
// Copied verbatim from the backend; backend/tests/test_pricing.py fails if they drift apart:
//   MEDIAN_SQL       = services/pricing.py MEDIAN_SQL (the price verdict)
//   TREND_SQL        = services/pricing.py trend_sql(city=False, aggregate=True) (the trend chart)
//   AGGREGATE_SQL    = db/schema/10_lease.sql, the listings_monthly continuous aggregate

export const MEDIAN_SQL = `select
    count(*) filter (where lower(neighbourhood) = lower(%(neighbourhood)s)) as local_count,
    percentile_cont(0.5) within group (order by price_eur)
        filter (where lower(neighbourhood) = lower(%(neighbourhood)s))  as local_median,
    count(*)                                                             as city_count,
    percentile_cont(0.5) within group (order by price_eur)               as city_median
from listings
where rooms = %(rooms)s
  and listed_at >= now() - interval '12 months'`;

export const TREND_SQL = `select (bucket at time zone 'UTC')::date as month, median_eur, listing_count as n
from listings_monthly
where rooms = %(rooms)s and lower(neighbourhood) = lower(%(neighbourhood)s)
  and bucket >= (date_trunc('month', now() at time zone 'UTC') - interval '11 months') at time zone 'UTC'
order by bucket`;

export const AGGREGATE_SQL = `create materialized view listings_monthly
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select time_bucket('1 month', listed_at)                       as bucket,
       neighbourhood,
       rooms,
       percentile_cont(0.5) within group (order by price_eur)  as median_eur,
       count(*)                                                as listing_count
from listings
group by bucket, neighbourhood, rooms
with no data`;
