-- Thidal schema for Neon (Postgres)
-- Run this once against your Neon database before first deploy:
--   psql "$DATABASE_URL" -f backend/schema.sql

create extension if not exists pgcrypto;

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null unique,
  name        text not null,
  role        text not null check (role in ('player', 'owner')),
  created_at  timestamptz not null default now()
);

create table if not exists otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  code        text not null,
  expires_at  timestamptz not null,
  consumed    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_otp_phone on otp_codes(phone, consumed, expires_at);

create table if not exists turfs (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid references users(id) on delete set null,
  name           text not null,
  location       text not null,
  owner_name     text not null,
  website_url    text,
  logo_url       text,
  brand_color    text not null default '#4C9A5B',
  created_at     timestamptz not null default now()
);

create index if not exists idx_turfs_owner on turfs(owner_user_id);

create table if not exists slots (
  id                  uuid primary key default gen_random_uuid(),
  turf_id             uuid not null references turfs(id) on delete cascade,
  date                date not null,
  start_time          text not null,   -- '18:00'
  end_time            text not null,   -- '19:00'
  full_price          integer not null,          -- in rupees
  min_players         integer not null default 8,
  price_per_player    integer not null,           -- in rupees
  pool_window_minutes integer not null default 60,
  status              text not null default 'open',
    -- open | pooling | confirmed_pool | confirmed_full | cancelled
  pool_deadline       timestamptz,
  full_booking        jsonb,        -- { name, phone, amount } once confirmed_full
  full_booking_request jsonb,       -- { id, name, phone, amount, requested_at } pending owner decision
  created_at          timestamptz not null default now()
);

create table if not exists joined_players (
  id          uuid primary key default gen_random_uuid(),
  slot_id     uuid not null references slots(id) on delete cascade,
  name        text not null,
  phone       text not null,
  paid_amount integer not null,
  status      text not null default 'confirmed', -- confirmed | refunded
  joined_at   timestamptz not null default now()
);

create table if not exists activity_log (
  id        uuid primary key default gen_random_uuid(),
  turf_id   uuid references turfs(id) on delete cascade,
  slot_id   uuid references slots(id) on delete cascade,
  message   text not null,
  meta      jsonb,
  at        timestamptz not null default now()
);

create index if not exists idx_slots_turf on slots(turf_id);
create index if not exists idx_slots_status_deadline on slots(status, pool_deadline);
create index if not exists idx_joined_players_slot on joined_players(slot_id);
create index if not exists idx_activity_at on activity_log(at desc);

-- Seed one demo turf + today's slots so the app isn't empty on first run.
insert into turfs (id, name, location, owner_name)
values ('00000000-0000-0000-0000-000000000001', 'Green Zone Turf', 'Madurai, TN', 'Owner Demo')
on conflict (id) do nothing;

insert into slots (turf_id, date, start_time, end_time, full_price, min_players, price_per_player)
select '00000000-0000-0000-0000-000000000001', current_date, s.start_time, s.end_time, 800, 8, 100
from (values ('06:00','07:00'), ('07:00','08:00'), ('18:00','19:00'), ('19:00','20:00')) as s(start_time, end_time)
where not exists (
  select 1 from slots where turf_id = '00000000-0000-0000-0000-000000000001' and date = current_date
);
