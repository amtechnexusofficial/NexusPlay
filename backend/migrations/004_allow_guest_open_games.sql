-- Allow owners to enable/disable guest open-game hosting on their venue.
-- Owners can always host from the Owner Hub (authenticated createGame).
alter table venues
  add column if not exists allow_guest_open_games boolean not null default true;
