import { httpError } from "../errors.js";

// Platform-wide (cross-tenant) queries for the amtechnexus admin dashboard.
// Nothing here takes an organizationId — unlike every owner-scoped service,
// an admin is explicitly allowed to see across all tenants.

export async function getPlatformStats(sql) {
  const [orgRows, venueRows, ownerRows, playerRows, bookingRows] = await Promise.all([
    sql`select count(*)::int as count from organizations`,
    sql`select count(*)::int as count from venues`,
    sql`select count(*)::int as count from users where role = 'owner'`,
    sql`select count(*)::int as count from users where role = 'player'`,
    sql`
      select count(*)::int as total_bookings, coalesce(sum(amount_paid), 0)::int as total_revenue
      from bookings where status = 'confirmed'
    `,
  ]);
  return {
    organizations: orgRows[0].count,
    venues: venueRows[0].count,
    owners: ownerRows[0].count,
    players: playerRows[0].count,
    totalBookings: bookingRows[0].total_bookings,
    totalRevenue: bookingRows[0].total_revenue,
  };
}

// One row per venue with its org and owner contact folded in — the flat
// shape an admin actually wants ("who runs this turf, can I reach them,
// is it live") rather than organizations and venues as separate lists.
export async function listAllVenuesForAdmin(sql) {
  return sql`
    select v.id, v.name, v.slug, v.city, v.status, v.upi_id, v.created_at,
           o.id as organization_id, o.name as organization_name,
           (select u.name from organization_members om join users u on u.id = om.user_id
            where om.organization_id = o.id and om.org_role = 'owner' limit 1) as owner_name,
           (select u.email from organization_members om join users u on u.id = om.user_id
            where om.organization_id = o.id and om.org_role = 'owner' limit 1) as owner_email,
           (select u.phone from organization_members om join users u on u.id = om.user_id
            where om.organization_id = o.id and om.org_role = 'owner' limit 1) as owner_phone,
           (select count(*)::int from bookings b where b.venue_id = v.id and b.status = 'confirmed') as booking_count
    from venues v
    join organizations o on v.organization_id = o.id
    order by v.created_at desc
  `;
}

export async function setVenueStatusForAdmin(sql, venueId, status) {
  if (!["active", "inactive", "draft"].includes(status)) {
    throw httpError(400, "status must be 'active', 'inactive' or 'draft'");
  }
  const [venue] = await sql`update venues set status = ${status} where id = ${venueId} returning *`;
  if (!venue) throw httpError(404, "Venue not found");
  return venue;
}
