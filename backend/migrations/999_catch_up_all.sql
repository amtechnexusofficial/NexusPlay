-- Run this ONCE in your Neon SQL console. It's the complete set of every
-- migration in backend/schema.sql, in order, safe to re-run (every
-- statement uses IF NOT EXISTS / DROP+recreate / idempotent updates) —
-- so it's fine even if some of these already exist on your database.
-- This exists because individual pieces (upi_id, venue_id, skill_level...)
-- have been discovered and fixed one at a time; this catches up everything
-- at once so no more "column X does not exist" surprises.

-- Phase 1: direct-to-owner UPI payments + owner password login
alter table venues add column if not exists upi_id text;
alter table venues add column if not exists upi_name text;
alter table venues add column if not exists upi_qr_image text;

alter table bookings drop constraint if exists bookings_payment_status_check;
alter table bookings add constraint bookings_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'cash', 'partially_paid', 'refunded', 'cancelled', 'pending_verification'));

alter table payments drop constraint if exists payments_provider_check;
alter table payments add constraint payments_provider_check
  check (provider in ('razorpay', 'stripe', 'cash', 'upi'));

-- Phase 2: owner dashboard business-profile fields
alter table venues add column if not exists city text;
alter table venues add column if not exists pincode text;
alter table venues add column if not exists gstin text;
alter table venues add column if not exists business_type text;
alter table venues add column if not exists rules text;
alter table venues add column if not exists cancellation_policy text;

alter table court_slots add column if not exists block_reason text;
alter table bookings add column if not exists upi_utr text;

-- Open Games (pickup matches + full-slot inquiries)
alter table games add column if not exists skill_level text;
alter table games add column if not exists rules text;

alter table games drop constraint if exists games_status_check;
alter table games add constraint games_status_check
  check (status in ('open', 'full', 'confirmed', 'cancelled', 'converted_to_full_booking'));

alter table court_slots add column if not exists full_inquiry_client text;
alter table court_slots add column if not exists full_inquiry_phone text;
alter table court_slots add column if not exists full_inquiry_notes text;
alter table court_slots add column if not exists full_inquiry_amount integer;
alter table court_slots add column if not exists full_inquiry_status text;
alter table court_slots add column if not exists full_inquiry_requested_at timestamptz;

alter table bookings drop constraint if exists bookings_source_check;
alter table bookings add constraint bookings_source_check
  check (source in ('online', 'walk_in', 'marketplace', 'game', 'full_time_inquiry'));

-- Notification delivery
alter table notifications add column if not exists recipient_phone text;
alter table notifications add column if not exists message text;
create index if not exists idx_notifications_recipient_phone on notifications(recipient_phone);

-- Razorpay online payment gateway
alter table bookings add column if not exists razorpay_order_id text;

-- Fix schema drift on users.phone / role
alter table users alter column phone drop not null;

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin', 'owner', 'player'));

-- court_slots.venue_id was never actually defined anywhere in the schema
alter table court_slots add column if not exists venue_id uuid references venues(id) on delete cascade;

update court_slots cs set venue_id = c.venue_id
from courts c
where cs.court_id = c.id and cs.venue_id is null;

create index if not exists idx_court_slots_venue_date on court_slots(venue_id, date, status);
