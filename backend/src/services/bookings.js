import { httpError } from "../errors.js";
import { withTransaction } from "../db.js";
import { findOrCreateCustomerInTx, recordCustomerBookingInTx } from "./customers.js";
import { getPaymentProvider } from "./payments.js";
import { notifyInTx } from "./notifications.js";

const HOLD_MINUTES = 10;

// Step 1 of the booking flow: atomically lock a slot for HOLD_MINUTES while
// the customer fills in payment details. Uses `select ... for update` inside
// a real transaction (not the stateless HTTP sql client) so two customers
// racing for the same slot can't both succeed — the second one blocks on
// the row lock until the first transaction commits, then sees the slot as
// 'held' and is rejected. The partial unique index on bookings
// (court_slot_id where status in pending_payment/confirmed) is a second,
// database-level backstop against the same race.
export async function holdSlot(env, { slotId, customerName, customerPhone, customerEmail, paymentMethod = "upi" }) {
  if (!slotId || !customerPhone) throw httpError(400, "slotId and customerPhone are required");

  const { booking, slot, venue } = await withTransaction(env, async (client) => {
    const { rows: slotRows } = await client.query("select * from court_slots where id = $1 for update", [slotId]);
    const slot = slotRows[0];
    if (!slot) throw httpError(404, "Slot not found");

    const now = Date.now();
    const isAvailable = slot.status === "open" || (slot.status === "held" && slot.hold_expires_at && new Date(slot.hold_expires_at).getTime() < now);
    if (!isAvailable) {
      throw httpError(409, `Slot is currently ${slot.status === "booked" ? "booked" : "being reserved by another customer"}. Please pick another time.`);
    }

    // court_slots.status stays 'open' while a pickup game is filling up on
    // it (it isn't fully booked yet), so without this check a player could
    // instant-hold the whole slot here and silently pull it out from under
    // players who already joined and paid into the open game — bypassing
    // the owner-reviewed refund flow in requestFullSlot/convertSlotToFullInquiry
    // entirely. Route them through that flow instead.
    const { rows: activeGameRows } = await client.query(
      "select id from games where court_slot_id = $1 and status in ('open', 'confirmed')",
      [slotId]
    );
    if (activeGameRows[0]) {
      throw httpError(409, "This slot already has an open pickup game — join it or request the full slot instead of booking directly.");
    }

    // Clear any stale pending booking left over from an expired hold on
    // this slot so the active-slot unique index doesn't reject the insert.
    await client.query(
      "update bookings set status = 'cancelled', payment_status = 'cancelled', notes = 'Hold expired' where court_slot_id = $1 and status = 'pending_payment'",
      [slotId]
    );

    const customer = await findOrCreateCustomerInTx(client, slot.organization_id, {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
    });

    const holdExpiresAt = new Date(now + HOLD_MINUTES * 60 * 1000).toISOString();
    await client.query("update court_slots set status = 'held', hold_expires_at = $1 where id = $2", [holdExpiresAt, slotId]);

    const { rows: venueRows } = await client.query("select * from venues where id = $1", [slot.venue_id]);
    const venue = venueRows[0];
    // The owner decides how much of the slot price actually needs to be
    // paid to lock it (advance_payment_percent, default 100 = full price,
    // same as before this existed) — a deposit-only booking still owes
    // the rest at the venue, but the slot is reserved either way. Frozen
    // onto the booking row at hold time so a later change to the venue's
    // setting can't retroactively change what an in-flight booking owes.
    const advancePercent = venue?.advance_payment_percent ?? 100;
    const advanceAmount = advancePercent >= 100 ? slot.price : Math.max(1, Math.round((slot.price * advancePercent) / 100));

    const { rows: bookingRows } = await client.query(
      `insert into bookings (organization_id, venue_id, court_id, court_slot_id, customer_id, source, status, payment_status, total_amount, amount_paid, advance_amount, hold_expires_at, notes)
       values ($1, $2, $3, $4, $5, 'online', 'pending_payment', 'pending', $6, 0, $7, $8, $9)
       returning *`,
      [slot.organization_id, slot.venue_id, slot.court_id, slotId, customer.id, slot.price, advanceAmount, holdExpiresAt, `Locked for ${(customerName || "Customer").trim()}`]
    );

    return { booking: bookingRows[0], slot: { ...slot, status: "held", hold_expires_at: holdExpiresAt }, venue };
  });

  const paymentOrder = await getPaymentProvider(paymentMethod === "razorpay" ? "razorpay" : "upi", env).createOrder({
    amount: booking.advance_amount,
    currency: "INR",
    bookingId: booking.id,
    customer: { name: customerName, phone: customerPhone, email: customerEmail },
    venue,
  });

  // Razorpay's checkout modal needs the order it's paying against, and
  // confirmBooking below re-checks the signature against this exact order
  // id so a customer can't submit a signature from a payment made against
  // a different booking.
  if (paymentOrder.provider === "razorpay") {
    await withTransaction(env, async (client) => {
      await client.query("update bookings set razorpay_order_id = $1 where id = $2", [paymentOrder.orderId, booking.id]);
    });
  }

  return {
    bookingId: booking.id,
    holdExpiresAt: booking.hold_expires_at,
    lockMinutes: HOLD_MINUTES,
    slot,
    venue,
    paymentOrder,
    advanceAmount: booking.advance_amount,
    totalAmount: booking.total_amount,
  };
}

// Step 2: customer submits payment (UPI UTR) or chooses pay-at-venue. The
// booking moves to 'confirmed' immediately — the slot is locked either way
// — but payment_status stays 'pending_verification' until the owner checks
// their bank statement and confirms the credit (see owner UPI verification
// endpoints, Phase 2).
export async function confirmBooking(env, { bookingId, paymentProvider = "upi", utr = "", razorpayPaymentId = "", razorpaySignature = "", splitCount = 1, participants = [] }) {
  if (!bookingId) throw httpError(400, "bookingId is required");

  return withTransaction(env, async (client) => {
    const { rows } = await client.query("select * from bookings where id = $1 for update", [bookingId]);
    const booking = rows[0];
    if (!booking) throw httpError(404, "Booking not found");
    if (booking.status === "confirmed") return { booking, paymentStatus: booking.payment_status, idempotent: true };
    if (booking.status !== "pending_payment") throw httpError(409, `Booking is ${booking.status}, cannot confirm`);

    // "Pay at Turf" (booking instantly with nothing collected at all) has
    // been removed from the online flow — a player either pays the full
    // amount or the venue's configured advance via UPI. Cash still exists
    // as a provider, but only for the owner's own in-person walk-in flow
    // (services/owner.js), which doesn't go through this function.
    const isRazorpay = paymentProvider === "razorpay";
    const cleanUtr = utr.trim();

    if (isRazorpay) {
      // Unlike UPI (owner manually checks their bank statement), a
      // Razorpay signature is cryptographic proof of payment — this
      // either verifies or throws, there's no "pending" middle state.
      await getPaymentProvider("razorpay", env).verifyPayment({
        orderId: booking.razorpay_order_id,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      });
    } else {
      await getPaymentProvider("upi").verifyPayment({ utr: cleanUtr }).catch(() => {
        // A malformed UTR still lets the booking through as 'pending' —
        // the owner's manual verification is the real gate, this just
        // decides whether to show it as "verification in progress".
      });
    }

    // amount_paid is the advance frozen onto the booking at hold time, not
    // necessarily the full total_amount — see holdSlot.
    const amountPaid = isRazorpay ? booking.total_amount : booking.advance_amount ?? booking.total_amount;
    const paymentStatus = isRazorpay ? "paid" : cleanUtr ? "pending_verification" : "pending";
    const notes = isRazorpay
      ? `Paid online via Razorpay | Payment ID: ${razorpayPaymentId}`
      : cleanUtr
      ? `Submitted via owner UPI QR | UTR: ${cleanUtr}`
      : "Awaiting owner UPI verification";

    await client.query("update court_slots set status = 'booked', hold_expires_at = null where id = $1", [booking.court_slot_id]);

    const { rows: updatedRows } = await client.query(
      `update bookings set status = 'confirmed', payment_status = $1, amount_paid = $2, notes = $3, upi_utr = $4, hold_expires_at = null, updated_at = now()
       where id = $5 returning *`,
      [paymentStatus, amountPaid, notes, cleanUtr || null, bookingId]
    );

    const provider = isRazorpay ? "razorpay" : "upi";
    await client.query(
      `insert into payments (organization_id, booking_id, provider, provider_payment_id, provider_order_id, amount, status, method)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        booking.organization_id,
        bookingId,
        provider,
        isRazorpay ? razorpayPaymentId : null,
        isRazorpay ? booking.razorpay_order_id : null,
        amountPaid,
        isRazorpay ? "captured" : "created",
        provider,
      ]
    );

    const customer = await recordCustomerBookingInTx(client, booking.customer_id, amountPaid);

    const { rows: slotRows } = await client.query("select * from court_slots where id = $1", [booking.court_slot_id]);
    const { rows: venueRows } = await client.query("select * from venues where id = $1", [booking.venue_id]);
    const slot = slotRows[0];
    const venue = venueRows[0];

    const balanceDue = booking.total_amount - amountPaid;
    await notifyInTx(client, {
      organizationId: booking.organization_id,
      recipientPhone: customer.phone,
      type: "booking_confirmation",
      message: isRazorpay
        ? `Payment received! Your slot at ${venue.name} on ${slot.date} (${slot.start_time} - ${slot.end_time}) is confirmed.`
        : cleanUtr
        ? `Your slot at ${venue.name} on ${slot.date} (${slot.start_time} - ${slot.end_time}) is locked! UTR #${cleanUtr} submitted to the venue owner for credit confirmation.${balanceDue > 0 ? ` Balance of ₹${balanceDue} due at the venue.` : ""}`
        : `Your slot at ${venue.name} on ${slot.date} (${slot.start_time} - ${slot.end_time}) is reserved. Complete your UPI payment to confirm.`,
    });

    if (isRazorpay) {
      await notifyInTx(client, {
        organizationId: booking.organization_id,
        recipientPhone: venue.phone,
        type: "payment_confirmation",
        message: `Online payment verified (₹${booking.total_amount}) from ${customer.name || customer.phone} for the slot on ${slot.date} at ${slot.start_time}. No UTR to check — this one was paid through the gateway.`,
      });
    }

    if (!isRazorpay && cleanUtr) {
      await notifyInTx(client, {
        organizationId: booking.organization_id,
        recipientPhone: venue.phone,
        type: "payment_confirmation",
        message: `UPI payment to verify (₹${amountPaid}${balanceDue > 0 ? ` advance, ₹${balanceDue} balance at venue` : ""}): ${customer.name || customer.phone} submitted UTR #${cleanUtr} for the slot on ${slot.date} at ${slot.start_time}. Check your bank credit and confirm in the owner dashboard.`,
      });
    }

    // Split payment: the organizer already paid (or is paying at venue)
    // for the whole booking above — these rows are reimbursement tracking
    // for teammates, each with their own shareable link, not a second
    // payment gate on the booking itself.
    const shareLinks = [];
    const count = Math.max(1, Number(splitCount) || 1);
    if (count > 1) {
      const shareAmount = Math.round(booking.total_amount / count);
      for (let i = 0; i < count; i++) {
        const name = participants[i]?.name || `Player ${i + 1}`;
        const phone = participants[i]?.phone || "";
        const status = i === 0 ? "paid" : "pending";
        const { rows: partRows } = await client.query(
          `insert into booking_participants (booking_id, name, phone, share_amount, payment_status)
           values ($1, $2, $3, $4, $5) returning *`,
          [bookingId, name, phone, shareAmount, status]
        );
        const p = partRows[0];
        shareLinks.push({ participantId: p.id, name: p.name, token: p.payment_link_token, shareAmount: p.share_amount, status: p.payment_status });
      }
    }

    return { booking: updatedRows[0], customer, paymentStatus, shareLinks };
  });
}

// Customer backs out before paying (closes the checkout, hold isn't
// needed anymore) — free the slot and cancel the pending booking.
export async function releaseHold(env, { bookingId, slotId }) {
  return withTransaction(env, async (client) => {
    if (slotId) {
      await client.query("update court_slots set status = 'open', hold_expires_at = null where id = $1 and status = 'held'", [slotId]);
    }
    if (bookingId) {
      await client.query(
        "update bookings set status = 'cancelled', payment_status = 'cancelled', notes = 'Released by user' where id = $1 and status = 'pending_payment'",
        [bookingId]
      );
    }
    return { ok: true };
  });
}

// Sweeps expired holds back to 'open' — wired into the Cron Trigger in
// wrangler.toml (runs every minute). Prevents a slot from staying stuck
// 'held' forever if a customer abandons checkout without releasing it.
export async function sweepExpiredHolds(env) {
  return withTransaction(env, async (client) => {
    const { rows: expired } = await client.query(
      "select id from court_slots where status = 'held' and hold_expires_at < now()"
    );
    if (expired.length === 0) return { swept: 0 };
    const ids = expired.map((r) => r.id);
    await client.query("update court_slots set status = 'open', hold_expires_at = null where id = any($1::uuid[])", [ids]);
    await client.query(
      "update bookings set status = 'cancelled', payment_status = 'cancelled', notes = 'Hold expired' where court_slot_id = any($1::uuid[]) and status = 'pending_payment'",
      [ids]
    );
    return { swept: ids.length };
  });
}
