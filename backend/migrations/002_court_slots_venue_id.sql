-- Run against your Neon DATABASE_URL (safe to re-run):
--   psql "$DATABASE_URL" -f backend/migrations/002_court_slots_venue_id.sql
--
-- Fixes: column "venue_id" of relation "court_slots" does not exist
--
-- venue_id was never actually defined on court_slots anywhere in
-- schema.sql (only organization_id and court_id were), even though slot
-- generation, listLiveSlots, listSlots, holdSlot and walk-in bookings all
-- assume it exists. This adds it and backfills existing rows via court_id.

alter table court_slots add column if not exists venue_id uuid references venues(id) on delete cascade;

update court_slots cs set venue_id = c.venue_id
from courts c
where cs.court_id = c.id and cs.venue_id is null;

create index if not exists idx_court_slots_venue_date on court_slots(venue_id, date, status);
