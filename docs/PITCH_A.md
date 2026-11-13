# Pitch, Person A: Gemini and Tiger Data (2 minutes)

Our part of the pitch: the lease check. Gemini reads the contract and Tiger Data prices it. The rule for the whole section is **show, don't claim**: every sentence about Gemini or TimescaleDB has something on screen behind it, either the raw JSON or the SQL, in the "How this was checked" panel under the result.

## Before going on stage

- Backend with `DEMO_CACHE=1` in `backend/.env`, so `demo_ro.txt` answers from `data/sample_leases/demo_ro.json` in under a second, with no Gemini quota or wifi risk. Every other lease still goes to Gemini live.
- Logged in (or `VITE_DEV_USER` set), on `/lease`, with `data/sample_leases/demo_ro.txt` open in an editor, ready to copy.
- Browser zoom at 125% so the back row can read the JSON.
- Plan B if the backend is down: the panel screenshots in [`docs/pitch-a/`](pitch-a/) (desktop and 375 px, one per tab).

## Demo click path

1. On `/lease`, paste the whole of `data/sample_leases/demo_ro.txt` into **Lease text**.
2. **Neighbourhood**: Circumvalațiunii. **Rooms**: 2. **Monthly rent**: 500. **Report language**: English (the cached demo is in English; Română goes to Gemini live).
3. Click **Check my lease**. The result shows **Fair price** (+2.0% against a median of €490 from 50 listings) next to **High risk** with 7 risky clauses and 1 missing clause.
4. Under the result, open **How this was checked**.
5. **Sent to Gemini** tab: point at the 4 highlighted `[REDACTED]` markers (CI, CNP, passport, IBAN).
6. **Gemini's raw answer** tab: scroll once through the JSON and point at `"overall_risk": "high"`.
7. **The SQL** tab: the median query, then the trend query on `listings_monthly`. Open **How listings_monthly is defined** if a judge asks.
8. Scroll down to the **Price trend** chart (it reads the same continuous aggregate).

## Talk track

About 290 words, which is 2 minutes at a calm pace. The bracketed lines say what is on screen.

**0:00 to 0:20, the problem.**
"Mei just moved to Timișoara. Her landlord sends a Romanian lease and wants a deposit by Friday. She can't read the clauses, and she has no idea whether 500 euros is a fair price. Those are two different questions, and we answer both before she pays anything."
[Paste the demo lease, pick Circumvalațiunii, 2 rooms, 500 euros, and submit.]

**0:20 to 1:00, Gemini.**
"The clause check is Gemini. But before anything leaves our server, we strip out her CNP, her ID card, her passport number and the IBAN."
[Open "How this was checked", Sent to Gemini tab.]
"This is exactly what Gemini saw. Four personal IDs, gone, and only this redacted copy is stored. Gemini answers in structured JSON against a schema we define, and we validate it with Pydantic and retry once if it is malformed."
[Gemini's raw answer tab.]
"No scraping of free text: the report you saw is rendered straight from this. Seven risky clauses, quoted in the original Romanian and explained in English. A 2% daily late fee, and the landlord can walk in without notice. If Gemini is down, the price check still answers."

**1:00 to 1:40, Tiger Data.**
"The price check is plain SQL on Tiger Cloud."
[The SQL tab.]
"Listings are a TimescaleDB hypertable. One query gets the neighbourhood median and the city-wide median together, with `percentile_cont`, so with too few local listings we fall back to the city honestly. Here: 50 listings, median 490, so 500 is fair."
[Scroll to the trend query, then to the Price trend chart.]
"The trend chart reads a continuous aggregate: monthly medians that TimescaleDB refreshes every hour, and the current month is real-time, so a new listing shows up straight away."

**1:40 to 2:00, close.**
"So Mei learns that the price is fine but the contract is not, and exactly which clauses to push back on, before she pays a deposit. A newcomer can trust what they see, because we show them how we checked."

## Proof SQL

Run on 2026-11-13 against our Tiger Cloud service (TimescaleDB 2.32.0). Paste any of these into the Tiger console SQL editor if a judge wants it live. Output was fetched with psycopg and formatted like psql.

**TimescaleDB is installed, and listings is a hypertable.**

```sql
select extversion as timescaledb from pg_extension where extname = 'timescaledb';
```

```text
 timescaledb
-------------
 2.32.0
(1 row)
```

```sql
select hypertable_name, num_chunks
from timescaledb_information.hypertables;
```

```text
 hypertable_name | num_chunks
-----------------+------------
 listings        | 53
(1 row)
```

**Two continuous aggregates, both real-time** (`materialized_only = false`: months not yet materialized are read live from `listings`).

```sql
select view_name, materialized_only, materialization_hypertable_name
from timescaledb_information.continuous_aggregates
order by view_name;
```

```text
       view_name       | materialized_only | materialization_hypertable_name
-----------------------+-------------------+---------------------------------
 listings_monthly      | False             | _materialized_hypertable_4
 listings_monthly_city | False             | _materialized_hypertable_5
(2 rows)
```

**Hourly refresh policies.** In TimescaleDB 2.32, `jobs.hypertable_name` holds the continuous aggregate's own name, so there is no need to join through the materialization hypertable.

```sql
select j.job_id, j.hypertable_name as view_name, j.schedule_interval,
       j.config ->> 'start_offset' as start_offset,
       j.config ->> 'end_offset'   as end_offset,
       s.last_run_status, s.total_runs, s.total_failures
from timescaledb_information.jobs j
left join timescaledb_information.job_stats s using (job_id)
where j.proc_name = 'policy_refresh_continuous_aggregate'
order by j.job_id;
```

```text
 job_id |       view_name       | schedule_interval | start_offset | end_offset | last_run_status | total_runs | total_failures
--------+-----------------------+-------------------+--------------+------------+-----------------+------------+----------------
 1001   | listings_monthly      | 1:00:00           | 1 year 1 mon | 01:00:00   | Success         | 1          | 0
 1002   | listings_monthly_city | 1:00:00           | 1 year 1 mon | 01:00:00   | Success         | 1          | 0
(2 rows)
```

**City-wide monthly median for 2 rooms, from the continuous aggregate.** November is the current month (real-time, so far).

```sql
select (bucket at time zone 'UTC')::date as month,
       round(median_eur::numeric, 1)    as median_eur,
       listing_count
from listings_monthly_city
where rooms = 2
order by bucket desc
limit 12;
```

```text
   month    | median_eur | listing_count
------------+------------+---------------
 2026-11-01 | 465.0      | 13
 2026-10-01 | 475.0      | 29
 2026-09-01 | 485.0      | 35
 2026-08-01 | 455.0      | 28
 2026-07-01 | 445.0      | 35
 2026-06-01 | 465.0      | 38
 2026-05-01 | 440.0      | 45
 2026-04-01 | 457.5      | 30
 2026-03-01 | 440.0      | 58
 2026-02-01 | 450.0      | 35
 2026-01-01 | 437.5      | 38
 2025-12-01 | 422.5      | 46
(12 rows)
```

**The demo's verdict, by hand.** The same median the app reports for Circumvalațiunii, 2 rooms: 500 is +2.0% against 490, inside the ±10% fair band.

```sql
select count(*) as listings,
       round((percentile_cont(0.5) within group (order by price_eur))::numeric, 1) as median_eur
from listings
where rooms = 2 and neighbourhood = 'Circumvalațiunii'
  and listed_at >= now() - interval '12 months';
```

```text
 listings | median_eur
----------+------------
 50       | 490.0
(1 row)
```

## If a judge asks

- **"Is the listing data real?"** No. It is about 1000 sample listings drawn from the rent ranges in `data/rent_ranges.md`, and the app labels it as sample data. Swapping in a real feed only changes the inserts; the hypertable, the queries and the aggregates stay the same.
- **"Why a continuous aggregate and not a normal materialized view?"** It refreshes incrementally on a schedule instead of being rebuilt, and real-time aggregation adds the newest rows on read, so the chart is never stale.
- **"Why is the median exact?"** `percentile_cont` is allowed inside continuous aggregates since TimescaleDB 2.7. A city median cannot be rolled up from neighbourhood medians, so the city gets its own aggregate.
- **"What if Gemini makes something up?"** Every quote has to come verbatim from the lease (the panel shows the text it saw), the output must match our schema, and the page says "Not legal advice".
- **"What is stored?"** Only the redacted text, Gemini's JSON and the verdict, per user. Another user's analysis returns 404.
