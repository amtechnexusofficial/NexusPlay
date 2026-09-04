// Per-organization customer CRM. Both functions take a transaction client
// (node-postgres style, $1/$2 placeholders) since they're always called
// from inside the booking transaction in services/bookings.js — not the
// tagged-template `sql` client used elsewhere.

// Called when a slot is held: looks up or creates the customer record, but
// does NOT bump total_bookings/total_spend yet — a hold that expires
// without payment shouldn't count as a booking.
export async function findOrCreateCustomerInTx(client, organizationId, { name, phone, email }) {
  const cleanPhone = (phone || "").trim();
  if (!cleanPhone) throw Object.assign(new Error("Customer phone is required"), { status: 400 });
  const cleanName = (name || "").trim() || `Player ${cleanPhone.slice(-4)}`;

  const { rows } = await client.query(
    `insert into customers (organization_id, name, phone, email)
     values ($1, $2, $3, $4)
     on conflict (organization_id, phone) do update set
       name = excluded.name,
       email = coalesce(excluded.email, customers.email)
     returning *`,
    [organizationId, cleanName, cleanPhone, email || null]
  );
  return rows[0];
}

// Called when a booking is confirmed (payment submitted / cash chosen):
// this is what actually counts toward the customer's lifetime stats.
export async function recordCustomerBookingInTx(client, customerId, amount = 0) {
  const { rows } = await client.query(
    `update customers set
       total_spend = total_spend + $2,
       total_bookings = total_bookings + 1,
       last_booking_at = now()
     where id = $1
     returning *`,
    [customerId, amount]
  );
  return rows[0];
}
