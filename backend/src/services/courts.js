import { httpError } from "../errors.js";
import { getVenueForOrg } from "./venues.js";

export async function listCourtsForVenue(sql, organizationId, venueId) {
  await getVenueForOrg(sql, organizationId, venueId); // 404s if not this org's venue
  return sql`select * from courts where venue_id = ${venueId} and organization_id = ${organizationId} order by created_at`;
}

// Public: courts for the shareable venue page — no org check needed since
// getPublicVenue already filtered to active venues.
export async function listPublicCourtsForVenue(sql, venueId) {
  return sql`
    select id, venue_id, name, sport_id, capacity, slot_duration_minutes,
           base_price, peak_price, weekend_price, peak_hours, open_time, close_time
    from courts where venue_id = ${venueId} and status = 'active'
    order by created_at
  `;
}

export async function getCourtForOrg(sql, organizationId, courtId) {
  const [court] = await sql`select * from courts where id = ${courtId} and organization_id = ${organizationId}`;
  if (!court) throw httpError(404, "Court not found");
  return court;
}

export async function createCourt(sql, organizationId, venueId, input) {
  await getVenueForOrg(sql, organizationId, venueId);
  for (const field of ["name", "sportId", "basePrice"]) {
    if (input[field] === undefined || input[field] === null) throw httpError(400, `${field} is required`);
  }
  // Accepts either a real sport id (uuid) or its slug (e.g. 'football') —
  // the owner dashboard's Add Court form still uses hardcoded slugs.
  const [sport] = await sql`select id from sports where id::text = ${input.sportId} or slug = ${input.sportId}`;
  if (!sport) throw httpError(400, "Invalid sportId");
  input = { ...input, sportId: sport.id };

  const [court] = await sql`
    insert into courts (
      organization_id, venue_id, name, sport_id, capacity, slot_duration_minutes,
      base_price, peak_price, weekend_price, peak_hours, open_time, close_time, status
    ) values (
      ${organizationId}, ${venueId}, ${input.name}, ${input.sportId}, ${input.capacity ?? 1},
      ${input.slotDurationMinutes ?? 60}, ${input.basePrice}, ${input.peakPrice ?? null},
      ${input.weekendPrice ?? null}, ${JSON.stringify(input.peakHours || [])},
      ${input.openTime || null}, ${input.closeTime || null}, ${input.status || "active"}
    )
    returning *
  `;

  // venues.sport_ids drives the public booking page's "Select Sport" step,
  // but it's a separate field only touched by the Business Setup form — a
  // court added for a sport the owner never also ticked there left that
  // step showing no chips at all (or the wrong ones) even though the court
  // existed. Keep it in sync here instead of relying on the owner to set
  // both places.
  await sql`
    update venues set sport_ids = array_append(coalesce(sport_ids, '{}'), ${input.sportId}::uuid)
    where id = ${venueId} and not (${input.sportId}::uuid = any(coalesce(sport_ids, '{}')))
  `;

  return court;
}

export async function updateCourt(sql, organizationId, courtId, input) {
  const existing = await getCourtForOrg(sql, organizationId, courtId);
  const [updated] = await sql`
    update courts set
      name = ${input.name ?? existing.name},
      capacity = ${input.capacity ?? existing.capacity},
      slot_duration_minutes = ${input.slotDurationMinutes ?? existing.slot_duration_minutes},
      base_price = ${input.basePrice ?? existing.base_price},
      peak_price = ${input.peakPrice ?? existing.peak_price},
      weekend_price = ${input.weekendPrice ?? existing.weekend_price},
      peak_hours = ${input.peakHours !== undefined ? JSON.stringify(input.peakHours) : existing.peak_hours},
      open_time = ${input.openTime ?? existing.open_time},
      close_time = ${input.closeTime ?? existing.close_time},
      status = ${input.status ?? existing.status}
    where id = ${courtId} and organization_id = ${organizationId}
    returning *
  `;
  return updated;
}

// court_slots (and through it bookings/games) cascades on court delete —
// refuse rather than silently wiping real activity. Safe case this
// exists for: an accidental duplicate court (e.g. a double-submitted Add
// Court) with nothing but its own freshly-generated, still-open slots.
export async function deleteCourt(sql, organizationId, courtId) {
  await getCourtForOrg(sql, organizationId, courtId);
  const [activeSlot] = await sql`
    select id from court_slots where court_id = ${courtId} and status in ('booked', 'held')
  `;
  if (activeSlot) throw httpError(409, "This court has a real booking or an active hold — cancel it first");
  const [activeGame] = await sql`
    select g.id from games g join court_slots cs on g.court_slot_id = cs.id
    where cs.court_id = ${courtId} and g.status in ('open', 'confirmed')
  `;
  if (activeGame) throw httpError(409, "This court has an active open game — cancel it first");
  await sql`delete from courts where id = ${courtId} and organization_id = ${organizationId}`;
  return { ok: true };
}
