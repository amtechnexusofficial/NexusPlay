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
  // upi_id/upi_name were missing here despite every booking screen reading
  // venue.upi_id for its QR code — every player was silently shown the
  // frontend's hardcoded placeholder UPI ID instead of this venue's real
  // one, no matter what the owner set in Business Setup.
  const [venue] = await sql`
    select id, name, slug, description, address, lat, lng, phone, email,
           photos, amenities, sport_ids, open_time, close_time, advance_payment_percent,
           upi_id, upi_name, upi_qr_image, rules, cancellation_policy, allow_guest_open_games,
           (select round(avg(rating), 1) from reviews where venue_id = venues.id)::float as avg_rating,
           (select count(*)::int from reviews where venue_id = venues.id) as review_count
    from venues
    where (slug = ${slugOrId} or id::text = ${slugOrId}) and status = 'active'
  `;
  if (!venue) throw httpError(404, "Venue not found");
  return venue;
}

// min_price and today_available_slots_count are what the marketplace's
// "Sort by price" / "live availability" actually read — without them the
// UI silently sorts every venue as free with zero slots. avg_rating/
// review_count are real now (services/reviews.js) — null until a venue
// has at least one review, which the UI treats as "not yet rated".
export async function listPublicVenues(sql, { sportId, search } = {}) {
  // Previously composed via two separately-built sql`` fragments spliced
  // into a parent template (sql`where ... ${clauseA} ${clauseB}`), with
  // each clause conditionally an *empty* fragment (sql``) when its filter
  // wasn't in use — the marketplace's default, no-filter load hits this
  // exact case (both empty) and was throwing "syntax error at or near
  // $1". Rewritten as plain scalar parameters with inline null-checks
  // instead, which needs no fragment splicing at all.
  const sportIdParam = sportId || null;
  const searchParam = search ? `%${search}%` : null;

  return sql`
    select v.id, v.name, v.slug, v.description, v.address, v.city, v.lat, v.lng, v.photos, v.sport_ids,
           v.amenities, v.open_time, v.close_time,
           (select min(c.base_price) from courts c where c.venue_id = v.id and c.status = 'active') as min_price,
           (select count(*)::int from court_slots cs
            where cs.venue_id = v.id and cs.status = 'open'
              and cs.date = (timezone('Asia/Kolkata', now()))::date
              and cs.start_time::time > (timezone('Asia/Kolkata', now()))::time
           ) as today_available_slots_count,
           (select round(avg(rating), 1) from reviews where venue_id = v.id)::float as avg_rating,
           (select count(*)::int from reviews where venue_id = v.id) as review_count,
           -- Open pickup games happening today, still filling up — powers the
           -- home page's "🔥 open games" badge so players can spot a venue
           -- with a game to join without opening Open Games Hub first.
           (select count(*)::int from games g join court_slots cs on g.court_slot_id = cs.id
            where g.venue_id = v.id and g.status = 'open'
              and cs.date = (timezone('Asia/Kolkata', now()))::date
              and cs.start_time::time > (timezone('Asia/Kolkata', now()))::time
           ) as open_games_today_count
    from venues v
    where v.status = 'active'
      and (${sportIdParam}::uuid is null or ${sportIdParam}::uuid = any(v.sport_ids))
      and (${searchParam}::text is null or v.name ilike ${searchParam} or v.address ilike ${searchParam} or v.city ilike ${searchParam})
    order by v.created_at desc
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
      organization_id, name, slug, description, address, city, lat, lng, phone, email,
      photos, amenities, sport_ids, open_time, close_time, status, upi_id, upi_name, upi_qr_image,
      advance_payment_percent
    ) values (
      ${organizationId}, ${input.name}, ${slug}, ${input.description || null}, ${input.address},
      ${input.city || null}, ${input.lat ?? null}, ${input.lng ?? null}, ${input.phone || null}, ${input.email || null},
      ${JSON.stringify(input.photos || [])}, ${JSON.stringify(input.amenities || [])},
      ${input.sportIds || []}, ${input.openTime || "06:00"}, ${input.closeTime || "23:00"},
      ${input.status || "draft"}, ${input.upiId || input.upi_id || null}, ${input.upiName || input.upi_name || null}, ${input.upiQrImage || input.upi_qr_image || null},
      ${input.advancePaymentPercent ?? 100}
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
      city = ${input.city ?? existing.city},
      pincode = ${input.pincode ?? existing.pincode},
      gstin = ${input.gstin ?? existing.gstin},
      business_type = ${input.businessType ?? existing.business_type},
      rules = ${input.rules ?? existing.rules},
      cancellation_policy = ${input.cancellationPolicy ?? existing.cancellation_policy},
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
      upi_qr_image = ${input.upiQrImage ?? existing.upi_qr_image},
      advance_payment_percent = ${input.advancePaymentPercent ?? existing.advance_payment_percent},
      allow_guest_open_games = ${input.allowGuestOpenGames ?? existing.allow_guest_open_games},
      whatsapp_number = ${input.whatsappNumber !== undefined ? input.whatsappNumber : existing.whatsapp_number}
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
