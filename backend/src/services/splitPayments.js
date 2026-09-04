import { httpError } from "../errors.js";
import { getPaymentProvider } from "./payments.js";

// Each booking_participant row is a teammate's individual reimbursement
// share of an already-confirmed booking — this is the page a shared
// "/pay/<token>" link opens, showing what they owe and a UPI QR for it.
export async function getSplitShare(sql, token) {
  const [share] = await sql`
    select bp.*, b.total_amount as booking_total, b.status as booking_status,
           cs.date, cs.start_time, cs.end_time,
           v.name as venue_name, v.upi_id as venue_upi_id, v.upi_name as venue_upi_name,
           c.name as court_name
    from booking_participants bp
    join bookings b on bp.booking_id = b.id
    join court_slots cs on b.court_slot_id = cs.id
    join venues v on b.venue_id = v.id
    join courts c on b.court_id = c.id
    where bp.payment_link_token = ${token}
  `;
  if (!share) throw httpError(404, "Payment link not found");

  let paymentOrder = null;
  if (share.payment_status === "pending" && share.venue_upi_id) {
    paymentOrder = await getPaymentProvider("upi").createOrder({
      amount: share.share_amount,
      bookingId: `${share.booking_id}-${share.id}`,
      venue: { upi_id: share.venue_upi_id, upi_name: share.venue_upi_name, name: share.venue_name },
    });
  }

  return { share, paymentOrder };
}

export async function paySplitShare(sql, token, { utr }) {
  const [existing] = await sql`select * from booking_participants where payment_link_token = ${token}`;
  if (!existing) throw httpError(404, "Payment link not found");
  if (existing.payment_status === "paid") return { share: existing, alreadyPaid: true };

  const cleanUtr = (utr || "").trim();
  if (cleanUtr.length < 8) throw httpError(400, "A valid UPI reference / UTR number is required");

  const [updated] = await sql`
    update booking_participants set payment_status = 'paid'
    where payment_link_token = ${token}
    returning *
  `;
  return { share: updated };
}
