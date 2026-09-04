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

export async function deleteCourt(sql, organizationId, courtId) {
  await getCourtForOrg(sql, organizationId, courtId);
  await sql`delete from courts where id = ${courtId} and organization_id = ${organizationId}`;
  return { ok: true };
}
