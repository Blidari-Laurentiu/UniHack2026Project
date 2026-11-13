-- Shared schema. Changes need a message to the other person first.

create extension if not exists pgcrypto;

create table if not exists users (
    id           uuid primary key default gen_random_uuid(),
    auth0_sub    text unique not null,
    display_name text,
    email        text null,
    is_student   boolean default false,
    created_at   timestamptz default now()
);
