-- Run against your Neon DATABASE_URL (safe to re-run):
--   psql "$DATABASE_URL" -f backend/migrations/001_venue_profile_columns.sql
--
-- Fixes: column "upi_id" of relation "venues" does not exist
-- (and other owner-dashboard columns added after the initial schema).

alter table venues add column if not exists upi_id text;
alter table venues add column if not exists upi_name text;
alter table venues add column if not exists upi_qr_image text;
alter table venues add column if not exists city text;
alter table venues add column if not exists pincode text;
alter table venues add column if not exists gstin text;
alter table venues add column if not exists business_type text;
alter table venues add column if not exists rules text;
