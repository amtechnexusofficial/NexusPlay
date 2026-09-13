-- Venue branding logo for printable booking QR posters (separate from gallery photos).
-- Run against Neon: psql "$DATABASE_URL" -f backend/migrations/007_venue_logo_url.sql

alter table venues add column if not exists logo_url text;
