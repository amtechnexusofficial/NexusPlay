-- NexusPlay schema for Neon (Postgres)
-- Run once against a fresh Neon database:
--   psql "$DATABASE_URL" -f backend/schema.sql
--
-- This replaces the old single-turf "Thidal" schema. If you are migrating
-- an existing Thidal database, do NOT run this against it blindly — the
-- old turfs/slots/joined_players tables are superseded by
-- venues/courts/court_slots/bookings below. Export any data you need first.

create extension if not exists pgcrypto;

-- ===========================================================================
-- Tenancy & identity
-- ===========================================================================

create table if not exists organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  billing_email  text,
  created_at     timestamptz not null default now()
);

create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  email          text unique,
  phone          text unique,
  password_hash  text,
  name           text not null,
  role           text not null check (role in ('admin', 'owner', 'player')),
  created_at     timestamptz not null default now(),
  constraint users_email_or_phone check (email is not null or phone is not null)
);

create table if not exists otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  code        text not null,
  expires_at  timestamptz not null,
  consumed    boolean not null default false,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_otp_phone on otp_codes(phone, consumed, expires_at);

-- Org-level role, distinct from users.role (a user with users.role='owner'
-- can belong to exactly one org as 'owner'; 'manager'/'staff' are invited).
create table if not exists organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  org_role         text not null check (org_role in ('owner', 'manager', 'staff')),
  created_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists idx_org_members_user on organization_members(user_id);

-- Staff scoped to specific venues with narrower permissions
-- (e.g. create walk-ins, mark cash payments — not edit pricing/payouts).
create table if not exists staff_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  venue_id         uuid not null,  -- fk added after venues table exists
  permissions      jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

-- ===========================================================================
-- Catalog
-- ===========================================================================

create table if not exists sports (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  slug  text not null unique,
  icon  text
);

create table if not exists venues (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  slug             text not null unique,
  description      text,
  address          text,
  lat              double precision,
  lng              double precision,
  phone            text,
  email            text,
  photos           jsonb not null default '[]',
  amenities        jsonb not null default '[]',
  sport_ids        uuid[] not null default '{}',
  open_time        text not null default '06:00',
  close_time       text not null default '23:00',
  status           text not null default 'active' check (status in ('active', 'inactive', 'draft')),
  created_at       timestamptz not null default now()
);
create index if not exists idx_venues_org on venues(organization_id);

alter table staff_members
  add constraint staff_members_venue_fk foreign key (venue_id) references venues(id) on delete cascade;
create index if not exists idx_staff_members_venue on staff_members(venue_id);
create index if not exists idx_staff_members_org on staff_members(organization_id);

create table if not exists courts (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations(id) on delete cascade,
  venue_id                uuid not null references venues(id) on delete cascade,
  name                    text not null,
  sport_id                uuid not null references sports(id),
  capacity                integer not null default 1,
  slot_duration_minutes   integer not null default 60,
  base_price              integer not null,          -- minor units (paise/cents)
  peak_price              integer,
  weekend_price           integer,
  peak_hours              jsonb not null default '[]',   -- [{from:'18:00',to:'22:00'}]
  open_time               text,   -- overrides venue open_time if set
  close_time              text,
  status                  text not null default 'active' check (status in ('active', 'inactive')),
  created_at              timestamptz not null default now()
);
create index if not exists idx_courts_venue on courts(venue_id);
create index if not exists idx_courts_org on courts(organization_id);

-- ===========================================================================
-- Availability
-- ===========================================================================

create table if not exists court_slots (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  court_id            uuid not null references courts(id) on delete cascade,
  date                date not null,
  start_time          text not null,   -- '18:00'
  end_time            text not null,
  price               integer not null,   -- minor units, resolved base/peak/weekend at generation time
  status              text not null default 'open'
    check (status in ('open', 'held', 'booked', 'blocked', 'maintenance')),
  hold_expires_at     timestamptz,
  created_at          timestamptz not null default now(),
  unique (court_id, date, start_time)
);
create index if not exists idx_court_slots_lookup on court_slots(court_id, date, status);
create index if not exists idx_court_slots_hold_sweep on court_slots(status, hold_expires_at);

create table if not exists blackout_dates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  venue_id         uuid references venues(id) on delete cascade,
  court_id         uuid references courts(id) on delete cascade,
  date             date not null,
  reason           text,
  created_at       timestamptz not null default now()
);

create table if not exists holidays (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  venue_id         uuid references venues(id) on delete cascade,
  date             date not null,
  label            text,
  created_at       timestamptz not null default now()
);

-- ===========================================================================
-- Bookings, customers, payments
-- ===========================================================================

create table if not exists customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  phone            text not null,
  email            text,
  total_spend      integer not null default 0,
  total_bookings   integer not null default 0,
  last_booking_at  timestamptz,
  created_at       timestamptz not null default now(),
  unique (organization_id, phone)
);

create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  venue_id            uuid not null references venues(id) on delete cascade,
  court_id            uuid not null references courts(id) on delete cascade,
  court_slot_id       uuid not null references court_slots(id) on delete cascade,
  customer_id         uuid references customers(id) on delete set null,
  created_by_user_id  uuid references users(id) on delete set null,
  source              text not null default 'online'
    check (source in ('online', 'walk_in', 'marketplace', 'game')),
  status              text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show')),
  payment_status      text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'cash', 'partially_paid', 'refunded', 'cancelled')),
  total_amount        integer not null,
  amount_paid         integer not null default 0,
  hold_expires_at     timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_bookings_org on bookings(organization_id);
create index if not exists idx_bookings_venue_date on bookings(venue_id, created_at);
create index if not exists idx_bookings_customer on bookings(customer_id);
-- The double-booking guard: at most one active booking per slot.
create unique index if not exists uq_bookings_active_slot
  on bookings(court_slot_id)
  where status in ('pending_payment', 'confirmed');
create index if not exists idx_bookings_hold_sweep
  on bookings(status, hold_expires_at) where status = 'pending_payment';

create table if not exists booking_participants (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  name                text not null,
  phone               text,
  share_amount        integer not null,
  payment_status      text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  payment_link_token  uuid not null default gen_random_uuid(),
  created_at          timestamptz not null default now()
);
create index if not exists idx_booking_participants_booking on booking_participants(booking_id);

create table if not exists payments (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id) on delete cascade,
  booking_id           uuid not null references bookings(id) on delete cascade,
  provider             text not null check (provider in ('razorpay', 'stripe', 'cash')),
  provider_payment_id  text,
  provider_order_id    text,
  amount               integer not null,
  currency             text not null default 'INR',
  status               text not null default 'created'
    check (status in ('created', 'authorized', 'captured', 'failed', 'refunded')),
  method               text,
  raw_payload          jsonb,
  created_at           timestamptz not null default now()
);
create index if not exists idx_payments_booking on payments(booking_id);

create table if not exists refunds (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  payment_id          uuid not null references payments(id) on delete cascade,
  amount              integer not null,
  status              text not null default 'pending'
    check (status in ('pending', 'processed', 'failed')),
  reason              text,
  provider_refund_id  text,
  created_at          timestamptz not null default now()
);

-- ===========================================================================
-- Reviews
-- ===========================================================================

create table if not exists reviews (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  venue_id         uuid not null references venues(id) on delete cascade,
  customer_id      uuid references customers(id) on delete set null,
  booking_id       uuid references bookings(id) on delete set null,
  rating           integer not null check (rating between 1 and 5),
  comment          text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_reviews_venue on reviews(venue_id);

-- ===========================================================================
-- Notifications (structural — see services/notifications.js)
-- ===========================================================================

create table if not exists notifications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id) on delete cascade,
  user_id          uuid references users(id) on delete set null,
  customer_id      uuid references customers(id) on delete set null,
  type             text not null,   -- booking_confirmation | reminder | cancellation | reschedule | payment_confirmation
  channel          text not null default 'console',  -- console | sms | whatsapp | email
  status           text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  payload          jsonb not null default '{}',
  scheduled_for    timestamptz,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_notifications_pending on notifications(status, scheduled_for);

-- ===========================================================================
-- Phase 2: Open Games / marketplace
-- ===========================================================================

create table if not exists games (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  venue_id               uuid not null references venues(id) on delete cascade,
  court_id               uuid not null references courts(id) on delete cascade,
  court_slot_id          uuid not null references court_slots(id) on delete cascade,
  organizer_customer_id  uuid references customers(id) on delete set null,
  sport_id               uuid not null references sports(id),
  title                  text,
  starts_at              timestamptz not null,
  capacity               integer not null,
  price_per_player       integer not null,
  status                 text not null default 'open'
    check (status in ('open', 'full', 'confirmed', 'cancelled')),
  created_at             timestamptz not null default now()
);
create index if not exists idx_games_status_time on games(status, starts_at);

create table if not exists game_participants (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references games(id) on delete cascade,
  customer_id      uuid not null references customers(id) on delete cascade,
  payment_status   text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  share_amount     integer not null,
  joined_at        timestamptz not null default now(),
  unique (game_id, customer_id)
);

-- ===========================================================================
-- Seed data
-- ===========================================================================

insert into sports (name, slug, icon) values
  ('Football', 'football', '⚽'),
  ('Futsal', 'futsal', '⚽'),
  ('Cricket', 'cricket', '🏏'),
  ('Badminton', 'badminton', '🏸'),
  ('Pickleball', 'pickleball', '🎾'),
  ('Padel', 'padel', '🎾'),
  ('Tennis', 'tennis', '🎾'),
  ('Basketball', 'basketball', '🏀')
on conflict (name) do nothing;

-- ===========================================================================
-- Migration: direct-to-owner UPI payments + owner password login (Phase 1
-- booking flow). Safe to re-run against an already-provisioned database —
-- every statement below is idempotent.
-- ===========================================================================

alter table venues add column if not exists upi_id text;
alter table venues add column if not exists upi_name text;
alter table venues add column if not exists upi_qr_image text;

-- 'pending_verification': UPI UTR submitted by customer, awaiting the
-- owner checking their bank statement and confirming the credit.
alter table bookings drop constraint if exists bookings_payment_status_check;
alter table bookings add constraint bookings_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'cash', 'partially_paid', 'refunded', 'cancelled', 'pending_verification'));

alter table payments drop constraint if exists payments_provider_check;
alter table payments add constraint payments_provider_check
  check (provider in ('razorpay', 'stripe', 'cash', 'upi'));

-- ===========================================================================
-- Migration: owner dashboard business-profile fields (Phase 2).
-- ===========================================================================

alter table venues add column if not exists city text;
alter table venues add column if not exists pincode text;
alter table venues add column if not exists gstin text;
alter table venues add column if not exists business_type text;
alter table venues add column if not exists rules text;

alter table court_slots add column if not exists block_reason text;
alter table bookings add column if not exists upi_utr text;

-- ===========================================================================
-- Migration: Open Games (players self-organizing a pickup match on a slot,
-- and an owner's option to convert a partially-filled game into an
-- exclusive full-pitch booking).
-- ===========================================================================

alter table games add column if not exists skill_level text;
alter table games add column if not exists rules text;

-- 'converted_to_full_booking': an owner accepted a full-slot inquiry over
-- an in-progress open game, refunding the players who'd already joined.
alter table games drop constraint if exists games_status_check;
alter table games add constraint games_status_check
  check (status in ('open', 'full', 'confirmed', 'cancelled', 'converted_to_full_booking'));

-- A player (or team) can offer to book an open game's slot outright,
-- displacing the individual sign-ups; these fields track that inquiry
-- until the owner accepts or declines it.
alter table court_slots add column if not exists full_inquiry_client text;
alter table court_slots add column if not exists full_inquiry_phone text;
alter table court_slots add column if not exists full_inquiry_notes text;
alter table court_slots add column if not exists full_inquiry_amount integer;
alter table court_slots add column if not exists full_inquiry_status text;
alter table court_slots add column if not exists full_inquiry_requested_at timestamptz;

alter table bookings drop constraint if exists bookings_source_check;
alter table bookings add constraint bookings_source_check
  check (source in ('online', 'walk_in', 'marketplace', 'game', 'full_time_inquiry'));

-- ===========================================================================
-- Migration: notification delivery. Dispatch is still a stub (logs
-- instead of actually sending SMS/WhatsApp — see services/notifications.js),
-- but every trigger point now writes a real, queryable row here, and the
-- player dashboard's WhatsApp-alerts tab reads it directly.
-- ===========================================================================

alter table notifications add column if not exists recipient_phone text;
alter table notifications add column if not exists message text;
create index if not exists idx_notifications_recipient_phone on notifications(recipient_phone);
