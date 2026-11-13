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
