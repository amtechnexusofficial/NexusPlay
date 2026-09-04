import { httpError } from "../errors.js";

// A player's own view across every venue they've interacted with. Unlike
// the owner dashboard, this isn't organization-scoped — customers is a
// per-org table (a player who's booked at three different venues has
// three separate customer rows, one per org), so everything here joins
// through customers.phone to pull the whole cross-venue picture together.
export async function getPlayerDashboard(sql, phone) {
  const cleanPhone = (phone || "").trim();
  if (!cleanPhone) throw httpError(400, "phone is required");

  const [user] = await sql`select * from users where phone = ${cleanPhone} and role = 'player'`;

  const bookings = await sql`
    select b.*, cs.date, cs.start_time, cs.end_time,
           v.name as venue_name, c.name as court_name, sp.slug as sport_id
    from bookings b
    join court_slots cs on b.court_slot_id = cs.id
    join venues v on b.venue_id = v.id
    join courts c on b.court_id = c.id
    join sports sp on c.sport_id = sp.id
    join customers cust on b.customer_id = cust.id
    where cust.phone = ${cleanPhone} and b.status in ('confirmed', 'completed')
    order by cs.date desc, cs.start_time desc
    limit 50
  `;

  const games = await sql`
    select g.*, cs.date, cs.start_time, cs.end_time,
           v.name as venue_name, c.name as court_name,
           g.capacity as required_players, g.price_per_player as cost_per_player, gp.share_amount,
           (select count(*)::int from game_participants gp2 where gp2.game_id = g.id) as current_players
    from game_participants gp
    join games g on gp.game_id = g.id
    join court_slots cs on g.court_slot_id = cs.id
    join venues v on g.venue_id = v.id
    join courts c on g.court_id = c.id
    join customers cust on gp.customer_id = cust.id
    where cust.phone = ${cleanPhone} and g.status in ('open', 'confirmed')
    order by cs.date desc, cs.start_time desc
    limit 50
  `;

  const [totals] = await sql`
    select coalesce(sum(total_spend), 0)::int as total_spend, coalesce(sum(total_bookings), 0)::int as total_bookings
    from customers where phone = ${cleanPhone}
  `;

  const loyaltyTier = totals.total_bookings >= 10 ? "Loyal Player" : totals.total_bookings >= 3 ? "Active Player" : "New Player";

  return {
    profile: {
      name: user?.name || "Nexus Player",
      phone: cleanPhone,
      email: user?.email || null,
      totalSpent: totals.total_spend,
      totalBookings: totals.total_bookings,
      gamesJoined: games.length,
      loyaltyTier,
    },
    bookings,
    games,
  };
}

export async function listPlayerNotifications(sql, phone) {
  const cleanPhone = (phone || "").trim();
  if (!cleanPhone) return [];
  const last10 = cleanPhone.replace(/\D/g, "").slice(-10);
  return sql`
    select * from notifications
    where regexp_replace(recipient_phone, '[^0-9]', '', 'g') like ${"%" + last10}
    order by created_at desc
    limit 25
  `;
}
