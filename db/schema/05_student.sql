-- Student verification (shared, auth). A user proves they study at a university by typing
-- a code sent to their university email. Only then is users.is_student true.

alter table users add column if not exists university text;
alter table users add column if not exists student_email text;
alter table users add column if not exists student_verified_at timestamptz;

-- One university email can make only one account a student.
create unique index if not exists users_student_email_key
    on users (student_email) where student_email is not null;

-- is_student used to come from an Auth0 claim (email domain). Without a completed
-- verification it is no longer valid. Sample users from seed_events.py (auth0_sub
-- 'seed|...') keep their flag. Runs on every apply; a verified student is never touched.
update users set is_student = false
where is_student and student_verified_at is null and auth0_sub not like 'seed|%';

create table if not exists student_verifications (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references users (id) on delete cascade,
    university    text not null,
    student_email text not null,
    code_hash     text not null,
    attempts      integer not null default 0,
    created_at    timestamptz not null default now(),
    expires_at    timestamptz not null,
    used_at       timestamptz
);

create index if not exists student_verifications_user_idx
    on student_verifications (user_id, created_at desc);
