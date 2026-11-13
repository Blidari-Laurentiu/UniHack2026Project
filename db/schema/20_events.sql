-- Person B block: event groups.

create table if not exists interests (
    id    uuid primary key default gen_random_uuid(),
    slug  text unique not null,
    label text not null
);

create table if not exists user_interests (
    user_id     uuid not null references users (id) on delete cascade,
    interest_id uuid not null references interests (id) on delete cascade,
    primary key (user_id, interest_id)
);

create table if not exists user_availability (
    user_id uuid not null references users (id) on delete cascade,
    slot    text not null check (slot in (
        'weekday_morning', 'weekday_evening',
        'weekend_morning', 'weekend_afternoon', 'weekend_evening')),
    primary key (user_id, slot)
);

create table if not exists events (
    id          uuid primary key default gen_random_uuid(),
    title       text not null,
    venue       text,
    starts_at   timestamptz not null,
    slot        text check (slot in (
        'weekday_morning', 'weekday_evening',
        'weekend_morning', 'weekend_afternoon', 'weekend_evening')),
    interest_id uuid references interests (id),
    description text,
    created_at  timestamptz default now()
);

create index if not exists events_starts_at_idx on events (starts_at);

create table if not exists event_signups (
    id         uuid primary key default gen_random_uuid(),
    event_id   uuid not null references events (id) on delete cascade,
    user_id    uuid not null references users (id) on delete cascade,
    status     text not null default 'waiting'
               check (status in ('waiting', 'grouped', 'left')),
    created_at timestamptz default now(),
    unique (event_id, user_id)
);

create index if not exists event_signups_event_status_idx
    on event_signups (event_id, status);

create table if not exists event_groups (
    id         uuid primary key default gen_random_uuid(),
    event_id   uuid not null references events (id) on delete cascade,
    meet_at    timestamptz,
    note       text,
    created_at timestamptz default now()
);

create table if not exists group_members (
    group_id uuid not null references event_groups (id) on delete cascade,
    user_id  uuid not null references users (id) on delete cascade,
    primary key (group_id, user_id)
);

create table if not exists reports (
    id               uuid primary key default gen_random_uuid(),
    reporter_id      uuid references users (id) on delete set null,
    reported_user_id uuid references users (id) on delete set null,
    event_id         uuid references events (id) on delete set null,
    group_id         uuid references event_groups (id) on delete set null,
    reason           text not null,
    created_at       timestamptz default now()
);

-- Sentence shown on the group card, built by services/matching.py.
alter table event_groups add column if not exists why_you_match text;
