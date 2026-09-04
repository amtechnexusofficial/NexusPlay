import { httpError } from "../errors.js";

// Reviews are gated on having an actual completed/confirmed booking at the
// venue — phone-identified like the rest of this app's public flows (no
// JWT required), but not a free-for-all: prevents a review with no
// booking behind it.
export async function createReview(sql, { venueId, customerPhone, rating, comment }) {
  if (!venueId || !customerPhone) throw httpError(400, "venueId and customerPhone are required");
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw httpError(400, "rating must be an integer from 1 to 5");
  }

  const [venue] = await sql`select id, organization_id from venues where id = ${venueId}`;
  if (!venue) throw httpError(404, "Venue not found");

  const [booking] = await sql`
    select b.id, b.customer_id from bookings b
    join customers c on b.customer_id = c.id
    where b.venue_id = ${venueId} and c.phone = ${customerPhone} and b.status in ('confirmed', 'completed')
    order by b.created_at desc limit 1
  `;
  if (!booking) throw httpError(403, "Only customers with a booking at this venue can leave a review");

  const [existing] = await sql`select id from reviews where venue_id = ${venueId} and customer_id = ${booking.customer_id}`;
  if (existing) {
    const [updated] = await sql`
      update reviews set rating = ${ratingNum}, comment = ${comment || null}, created_at = now()
      where id = ${existing.id}
      returning *
    `;
    return updated;
  }

  const [review] = await sql`
    insert into reviews (organization_id, venue_id, customer_id, booking_id, rating, comment)
    values (${venue.organization_id}, ${venueId}, ${booking.customer_id}, ${booking.id}, ${ratingNum}, ${comment || null})
    returning *
  `;
  return review;
}

export async function listReviewsForVenue(sql, venueId) {
  return sql`
    select r.id, r.rating, r.comment, r.created_at, c.name as customer_name
    from reviews r
    left join customers c on r.customer_id = c.id
    where r.venue_id = ${venueId}
    order by r.created_at desc
    limit 50
  `;
}
