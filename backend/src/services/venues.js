import { httpError } from "../errors.js";

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(sql, name) {
  const base = slugify(name) || "venue";
  let slug = base;
  let n = 1;
  // Small tenant count expected per name collision, so a loop is fine —
  // this only runs on venue creation, not on hot paths.
  while (true) {
    const [existing] = await sql`select id from venues where slug = ${slug}`;
    if (!existing) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

// Every function here takes organizationId explicitly (not derived
// internally) so a caller can never accidentally omit the tenant filter —
// it has to be threaded through from requireOrg() in the route handler.

export async function listVenuesForOrg(sql, organizationId) {
  return sql`select * from venues where organization_id = ${organizationId} order by created_at desc`;
}

export async function getVenueForOrg(sql, organizationId, venueId) {
  const [venue] = await sql`select * from venues where id = ${venueId} and organization_id = ${organizationId}`;
  if (!venue) throw httpError(404, "Venue not found");
  return venue;
}

// Public: used by the shareable venue page and marketplace search — no
// organization check, but only ever returns active venues.
export async function getPublicVenue(sql, slugOrId) {
  const [venue] = await sql`
    select id, name, slug, description, address, lat, lng, phone, email,
           photos, amenities, sport_ids, open_time, close_time
    from venues
    where (slug = ${slugOrId} or id::text = ${slugOrId}) and status = 'active'
  `;
  if (!venue) throw httpError(404, "Venue not found");
  return venue;
}

export async function listPublicVenues(sql, { sportId, search } = {}) {
  if (sportId) {
    return sql`
      select id, name, slug, description, address, lat, lng, photos, sport_ids
      from venues
      where status = 'active' and ${sportId} = any(sport_ids)
      order by created_at desc
    `;
  }
  if (search) {
    return sql`
      select id, name, slug, description, address, lat, lng, photos, sport_ids
      from venues
      where status = 'active' and (name ilike ${"%" + search + "%"} or address ilike ${"%" + search + "%"})
      order by created_at desc
    `;
  }
  return sql`
    select id, name, slug, description, address, lat, lng, photos, sport_ids
    from venues where status = 'active' order by created_at desc
  `;
}

export async function createVenue(sql, organizationId, input) {
  const required = ["name", "address"];
  for (const field of required) {
    if (!input[field]) throw httpError(400, `${field} is required`);
  }
  const slug = await uniqueSlug(sql, input.name);
  const [venue] = await sql`
    insert into venues (
      organization_id, name, slug, description, address, lat, lng, phone, email,
      photos, amenities, sport_ids, open_time, close_time, status, upi_id, upi_name, upi_qr_image
    ) values (
      ${organizationId}, ${input.name}, ${slug}, ${input.description || null}, ${input.address},
      ${input.lat ?? null}, ${input.lng ?? null}, ${input.phone || null}, ${input.email || null},
      ${JSON.stringify(input.photos || [])}, ${JSON.stringify(input.amenities || [])},
      ${input.sportIds || []}, ${input.openTime || "06:00"}, ${input.closeTime || "23:00"},
      ${input.status || "draft"}, ${input.upiId || null}, ${input.upiName || null}, ${input.upiQrImage || null}
    )
    returning *
  `;
  return venue;
}

export async function updateVenue(sql, organizationId, venueId, input) {
  const existing = await getVenueForOrg(sql, organizationId, venueId);
  const [updated] = await sql`
    update venues set
      name = ${input.name ?? existing.name},
      description = ${input.description ?? existing.description},
      address = ${input.address ?? existing.address},
      lat = ${input.lat ?? existing.lat},
      lng = ${input.lng ?? existing.lng},
      phone = ${input.phone ?? existing.phone},
      email = ${input.email ?? existing.email},
      photos = ${input.photos !== undefined ? JSON.stringify(input.photos) : existing.photos},
      amenities = ${input.amenities !== undefined ? JSON.stringify(input.amenities) : existing.amenities},
      sport_ids = ${input.sportIds ?? existing.sport_ids},
      open_time = ${input.openTime ?? existing.open_time},
      close_time = ${input.closeTime ?? existing.close_time},
      status = ${input.status ?? existing.status},
      upi_id = ${input.upiId ?? existing.upi_id},
      upi_name = ${input.upiName ?? existing.upi_name},
      upi_qr_image = ${input.upiQrImage ?? existing.upi_qr_image}
    where id = ${venueId} and organization_id = ${organizationId}
    returning *
  `;
  return updated;
}

export async function deleteVenue(sql, organizationId, venueId) {
  await getVenueForOrg(sql, organizationId, venueId);
  await sql`delete from venues where id = ${venueId} and organization_id = ${organizationId}`;
  return { ok: true };
}
