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

-- Community events (POST /events). created_by is null for seeded events. Only 'active' events
-- are on the public list; 'pending' waits for a moderator (a new event from someone who is not
-- trusted yet, or an event with too many open reports); 'rejected' was removed by a moderator.
alter table events add column if not exists created_by uuid references users (id) on delete set null;
alter table events add column if not exists status text not null default 'active'
    check (status in ('active', 'pending', 'rejected'));

create index if not exists events_created_by_idx on events (created_by, created_at);

-- Report review (routers/moderation.py). Approving an event dismisses its open reports,
-- rejecting it marks them actioned; only open reports count towards hiding an event.
alter table reports add column if not exists status text not null default 'open'
    check (status in ('open', 'dismissed', 'actioned'));
alter table reports add column if not exists resolved_by uuid references users (id) on delete set null;
alter table reports add column if not exists resolved_at timestamptz;

-- One report per user per event, also after it was resolved.
create unique index if not exists reports_one_per_event_idx
    on reports (reporter_id, event_id)
    where event_id is not null and reported_user_id is null and group_id is null;
create index if not exists reports_event_open_idx on reports (event_id) where status = 'open';
