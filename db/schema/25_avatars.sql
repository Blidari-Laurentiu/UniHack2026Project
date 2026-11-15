-- Person B block: profile pictures.
-- The browser crops and resizes a picture to 256 px before upload, so one row is tens of kB.
-- A user without a row gets the mascot, drawn in the browser from the user id.

create table if not exists user_avatars (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null unique references users (id) on delete cascade,
    content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
    image        bytea not null check (octet_length(image) between 1 and 524288),
    updated_at   timestamptz not null default now()
);
