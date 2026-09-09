-- Run against Neon (safe to re-run):
--   psql "$DATABASE_URL" -f backend/migrations/003_cancellation_policy.sql

alter table venues add column if not exists cancellation_policy text;
