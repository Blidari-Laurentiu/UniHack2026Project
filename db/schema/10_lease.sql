-- Person A block: lease check and pricing.

create table if not exists listings (
    id            uuid not null default gen_random_uuid(),
    neighbourhood text not null,
    rooms         int not null,
    price_eur     numeric not null,
    area_m2       numeric,
    listed_at     timestamptz not null,
    primary key (id, listed_at)
);

create index if not exists listings_neighbourhood_rooms_idx
    on listings (neighbourhood, rooms);

create table if not exists lease_analyses (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid references users (id) on delete cascade,
    neighbourhood       text,
    rent_eur            numeric,
    rooms               int,
    lease_text_redacted text,
    result_json         jsonb,
    price_verdict       jsonb,
    created_at          timestamptz default now()
);

create index if not exists lease_analyses_user_created_idx
    on lease_analyses (user_id, created_at desc);

-- Make listings a hypertable only when TimescaleDB is installed,
-- so this file still runs on plain Postgres.
do $$
begin
    if exists (select 1 from pg_extension where extname = 'timescaledb') then
        execute $q$select create_hypertable('listings', 'listed_at', if_not_exists => true)$q$;
    end if;
end $$;

-- Monthly median rent as TimescaleDB continuous aggregates (the price-trend chart).
--   listings_monthly       per neighbourhood and room count
--   listings_monthly_city  per room count, city-wide (a median cannot be rolled up from
--                          neighbourhood medians, so the city gets its own exact one)
-- percentile_cont is allowed in continuous aggregates since TimescaleDB 2.7 (we run 2.32),
-- so the median is exact and matches services/pricing.py.
-- WITH NO DATA because a DO block runs inside a transaction, where materializing is not
-- allowed; db/seed_listings.py refreshes both right after seeding (with autocommit).
-- materialized_only = false: months not yet materialized are read from listings live
-- (real-time aggregation), so a new listing shows up before the policy runs.
-- Skipped on plain Postgres; services/pricing.py then reads listings directly.
do $$
begin
    if not exists (select 1 from pg_extension where extname = 'timescaledb') then
        return;
    end if;

    if not exists (select 1 from timescaledb_information.continuous_aggregates
                   where view_name = 'listings_monthly') then
        execute $q$
            create materialized view listings_monthly
            with (timescaledb.continuous, timescaledb.materialized_only = false) as
            select time_bucket('1 month', listed_at)                       as bucket,
                   neighbourhood,
                   rooms,
                   percentile_cont(0.5) within group (order by price_eur)  as median_eur,
                   count(*)                                                as listing_count
            from listings
            group by bucket, neighbourhood, rooms
            with no data
        $q$;
    end if;

    if not exists (select 1 from timescaledb_information.continuous_aggregates
                   where view_name = 'listings_monthly_city') then
        execute $q$
            create materialized view listings_monthly_city
            with (timescaledb.continuous, timescaledb.materialized_only = false) as
            select time_bucket('1 month', listed_at)                       as bucket,
                   rooms,
                   percentile_cont(0.5) within group (order by price_eur)  as median_eur,
                   count(*)                                                as listing_count
            from listings
            group by bucket, rooms
            with no data
        $q$;
    end if;

    -- Re-materialize the last 13 months every hour. The current, unfinished month is left
    -- to real-time aggregation (a bucket is only materialized once it is complete).
    perform add_continuous_aggregate_policy('listings_monthly',
        start_offset => interval '13 months', end_offset => interval '1 hour',
        schedule_interval => interval '1 hour', if_not_exists => true);
    perform add_continuous_aggregate_policy('listings_monthly_city',
        start_offset => interval '13 months', end_offset => interval '1 hour',
        schedule_interval => interval '1 hour', if_not_exists => true);
end $$;
