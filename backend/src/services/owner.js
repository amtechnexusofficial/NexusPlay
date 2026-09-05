import { httpError } from "../errors.js";
import { withTransaction } from "../db.js";
import { getVenueForOrg, updateVenue } from "./venues.js";
import { listCourtsForVenue } from "./courts.js";
import { findOrCreateCustomerInTx, recordCustomerBookingInTx } from "./customers.js";
import { notifyInTx, notify } from "./notifications.js";

// ===========================================================================
// Dashboard shell: venues + org info for the SaaS shell to bootstrap with.
// ===========================================================================

export async function getContext(sql, organizationId, user) {
  const [organization] = await sql`select id, name from organizations where id = ${organizationId}`;
  const venues = await sql`select * from venues where organization_id = ${organizationId} order by created_at desc`;

  // The dashboard shell (court dropdowns in the block/walk-in modals) reads
  // selectedVenue.courts directly, so embed each venue's courts here rather
  // than making the UI fetch them separately per venue.
  const venuesWithCourts = await Promise.all(
    venues.map(async (v) => ({
      ...v,
      courts: await sql`select * from courts where venue_id = ${v.id} and status = 'active' order by created_at`,
    }))
  );

  return { user, organization, venues: venuesWithCourts };
}

// ===========================================================================
// Analytics
// ===========================================================================

export async function getAnalytics(sql, organizationId, venueId) {
  // Always qualified with the `b` alias so it's unambiguous once joined
  // against courts/court_slots, which also have their own venue_id.
  const venueClause = venueId ? sql`and b.venue_id = ${venueId}` : sql``;

  const [today] = await sql`
    select coalesce(sum(amount_paid), 0)::int as revenue, count(*)::int as bookings
    from bookings b
    where organization_id = ${organizationId} and status in ('confirmed', 'completed')
      and created_at::date = current_date ${venueClause}
  `;
  const [week] = await sql`
    select coalesce(sum(amount_paid), 0)::int as revenue, count(*)::int as bookings
    from bookings b
    where organization_id = ${organizationId} and status in ('confirmed', 'completed')
      and created_at >= now() - interval '7 days' ${venueClause}
  `;
  const [month] = await sql`
    select coalesce(sum(amount_paid), 0)::int as revenue, count(*)::int as bookings
    from bookings b
    where organization_id = ${organizationId} and status in ('confirmed', 'completed')
      and created_at >= now() - interval '30 days' ${venueClause}
  `;
  const [total] = await sql`
    select coalesce(sum(amount_paid), 0)::int as revenue, count(*)::int as bookings
    from bookings b
    where organization_id = ${organizationId} and status in ('confirmed', 'completed') ${venueClause}
  `;

  const [occupancy] = await sql`
    select
      count(*) filter (where status = 'booked')::int as booked,
      count(*)::int as total
    from court_slots
    where organization_id = ${organizationId} and date = current_date ${venueId ? sql`and venue_id = ${venueId}` : sql``}
  `;
  const occupancyRate = occupancy.total > 0 ? Math.round((occupancy.booked / occupancy.total) * 100) : 0;

  const revenueByCourt = await sql`
    select c.id as court_id, c.name as court_name, coalesce(sum(b.amount_paid), 0)::int as revenue, count(b.id)::int as bookings
    from bookings b join courts c on b.court_id = c.id
    where b.organization_id = ${organizationId} and b.status in ('confirmed', 'completed') ${venueClause}
    group by c.id, c.name order by revenue desc
  `;

  const revenueBySport = await sql`
    select s.name as sport, coalesce(sum(b.amount_paid), 0)::int as revenue, count(b.id)::int as bookings
    from bookings b join courts c on b.court_id = c.id join sports s on c.sport_id = s.id
    where b.organization_id = ${organizationId} and b.status in ('confirmed', 'completed') ${venueClause}
    group by s.name order by revenue desc
  `;

  const peakHours = await sql`
    select cs.start_time, count(*)::int as bookings
    from bookings b join court_slots cs on b.court_slot_id = cs.id
    where b.organization_id = ${organizationId} and b.status in ('confirmed', 'completed') ${venueClause}
    group by cs.start_time order by bookings desc limit 3
  `;

  return {
    todayRevenue: today.revenue,
    todayBookings: today.bookings,
    weeklyRevenue: week.revenue,
    weeklyBookings: week.bookings,
    monthlyRevenue: month.revenue,
    monthlyBookings: month.bookings,
    totalRevenue: total.revenue,
    totalBookings: total.bookings,
    occupancyRate,
    revenueByCourt,
    revenueBySport,
    peakHours: peakHours.map((p) => p.start_time),
  };
}

// ===========================================================================
// Bookings list, walk-ins, cancel/reschedule/cash
// ===========================================================================

export async function listBookings(sql, organizationId, { venueId, date } = {}) {
  const venueClause = venueId ? sql`and b.venue_id = ${venueId}` : sql``;
  const dateClause = date ? sql`and cs.date = ${date}` : sql``;
  // Booking date/time live on court_slots, not bookings — a booking is one
  // slot, so this join is 1:1 (safe against fan-out).
  return sql`
    select b.*, cs.date, cs.start_time, cs.end_time,
           c.name as customer_name, c.phone as customer_phone,
           crt.name as court_name, v.name as venue_name
    from bookings b
    join court_slots cs on b.court_slot_id = cs.id
    left join customers c on b.customer_id = c.id
    left join courts crt on b.court_id = crt.id
    left join venues v on b.venue_id = v.id
    where b.organization_id = ${organizationId} ${venueClause} ${dateClause}
    order by cs.date desc, cs.start_time desc
    limit 200
  `;
}

// ===========================================================================
// Reports & Billing — a POS-style transaction log: every booking in a date
// range with its payment method, plus revenue/count summaries that are
// computed against the full range (not just the page of rows returned),
// so the numbers stay accurate even past the row cap below.
// ===========================================================================

export async function getBillingReport(sql, organizationId, { venueId, dateFrom, dateTo } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const from = dateFrom || thirtyDaysAgo;
  const to = dateTo || today;
  const venueClause = venueId ? sql`and b.venue_id = ${venueId}` : sql``;

  const transactions = await sql`
    select b.id, b.status, b.payment_status, b.total_amount, b.amount_paid, b.source,
           b.notes, b.upi_utr, b.created_at,
           cs.date, cs.start_time, cs.end_time,
           c.name as customer_name, c.phone as customer_phone,
           crt.name as court_name, v.name as venue_name,
           (select p.provider from payments p where p.booking_id = b.id order by p.created_at desc limit 1) as payment_provider
    from bookings b
    join court_slots cs on b.court_slot_id = cs.id
    left join customers c on b.customer_id = c.id
    left join courts crt on b.court_id = crt.id
    left join venues v on b.venue_id = v.id
    where b.organization_id = ${organizationId} ${venueClause}
      and cs.date >= ${from} and cs.date <= ${to}
    order by cs.date desc, cs.start_time desc
    limit 500
  `;

  const [totals] = await sql`
    select
      coalesce(sum(b.amount_paid) filter (where b.status in ('confirmed', 'completed')), 0)::int as total_revenue,
      count(*) filter (where b.status in ('confirmed', 'completed'))::int as total_bookings,
      count(*) filter (where b.status = 'cancelled')::int as cancelled_count,
      coalesce(sum(b.amount_paid) filter (where b.status in ('confirmed', 'completed')
        and (select p.provider from payments p where p.booking_id = b.id order by p.created_at desc limit 1) = 'upi'), 0)::int as upi_revenue,
      coalesce(sum(b.amount_paid) filter (where b.status in ('confirmed', 'completed')
        and (select p.provider from payments p where p.booking_id = b.id order by p.created_at desc limit 1) = 'cash'), 0)::int as cash_revenue,
      coalesce(sum(b.amount_paid) filter (where b.status in ('confirmed', 'completed')
        and (select p.provider from payments p where p.booking_id = b.id order by p.created_at desc limit 1) = 'razorpay'), 0)::int as razorpay_revenue
    from bookings b
    join court_slots cs on b.court_slot_id = cs.id
    where b.organization_id = ${organizationId} ${venueClause}
      and cs.date >= ${from} and cs.date <= ${to}
  `;

  return {
    dateFrom: from,
    dateTo: to,
    transactions,
    summary: {
      totalRevenue: totals.total_revenue,
      totalBookings: totals.total_bookings,
      cancelledCount: totals.cancelled_count,
      byMethod: {
        upi: totals.upi_revenue,
        cash: totals.cash_revenue,
        razorpay: totals.razorpay_revenue,
      },
    },
  };
}

// Fast owner-side booking: court + slot are confirmed immediately, no hold
// step, payment is recorded as already collected (cash or pre-arranged).
export async function createWalkIn(env, organizationId, input) {
  const { venueId, courtId, date, startTime, endTime, customerName, customerPhone, totalAmount, paymentMode = "cash" } = input;
  if (!venueId || !courtId || !date || !startTime || !customerPhone || totalAmount === undefined) {
    throw httpError(400, "venueId, courtId, date, startTime, customerPhone and totalAmount are required");
  }

  return withTransaction(env, async (client) => {
    const { rows: venueRows } = await client.query("select * from venues where id = $1 and organization_id = $2", [venueId, organizationId]);
    if (!venueRows[0]) throw httpError(404, "Venue not found");

    let { rows: slotRows } = await client.query(
      "select * from court_slots where court_id = $1 and date = $2 and start_time = $3 for update",
      [courtId, date, startTime]
    );
    let slot = slotRows[0];

    if (slot) {
      if (slot.status === "booked") throw httpError(409, "This slot is already booked");
      await client.query("update court_slots set status = 'booked', hold_expires_at = null where id = $1", [slot.id]);
    } else {
      const { rows } = await client.query(
        `insert into court_slots (court_id, venue_id, organization_id, date, start_time, end_time, price, status)
         values ($1, $2, $3, $4, $5, $6, $7, 'booked') returning *`,
        [courtId, venueId, organizationId, date, startTime, endTime || startTime, totalAmount]
      );
      slot = rows[0];
    }

    const customer = await findOrCreateCustomerInTx(client, organizationId, { name: customerName, phone: customerPhone });

    const { rows: bookingRows } = await client.query(
      `insert into bookings (organization_id, venue_id, court_id, court_slot_id, customer_id, source, status, payment_status, total_amount, amount_paid, notes)
       values ($1, $2, $3, $4, $5, 'walk_in', 'confirmed', $6, $7, $7, $8) returning *`,
      [organizationId, venueId, courtId, slot.id, customer.id, paymentMode === "cash" ? "cash" : "paid", totalAmount, `Walk-in booking for ${customerName || "Customer"}`]
    );

    await client.query(
      `insert into payments (organization_id, booking_id, provider, amount, status, method)
       values ($1, $2, 'cash', $3, 'captured', $4)`,
      [organizationId, bookingRows[0].id, totalAmount, paymentMode]
    );

    await recordCustomerBookingInTx(client, customer.id, totalAmount);

    return { bookingId: bookingRows[0].id, booking: bookingRows[0] };
  });
}

// action: 'mark_cash_paid' | 'cancel' | 'reschedule'
export async function updateBookingAction(env, organizationId, bookingId, { action, newDate, newStartTime, newEndTime }) {
  return withTransaction(env, async (client) => {
    const { rows } = await client.query("select * from bookings where id = $1 and organization_id = $2 for update", [bookingId, organizationId]);
    const booking = rows[0];
    if (!booking) throw httpError(404, "Booking not found");

    const { rows: customerRows } = await client.query("select * from customers where id = $1", [booking.customer_id]);
    const { rows: venueRows } = await client.query("select name from venues where id = $1", [booking.venue_id]);
    const customer = customerRows[0];
    const venueName = venueRows[0]?.name || "the venue";

    if (action === "mark_cash_paid") {
      const { rows: updated } = await client.query(
        "update bookings set payment_status = 'cash', status = 'confirmed', amount_paid = total_amount, updated_at = now() where id = $1 returning *",
        [bookingId]
      );
      return { booking: updated[0], message: "Cash payment marked as received" };
    }

    if (action === "cancel") {
      const { rows: updated } = await client.query(
        "update bookings set status = 'cancelled', payment_status = 'refunded', notes = 'Cancelled by owner', updated_at = now() where id = $1 returning *",
        [bookingId]
      );
      if (booking.court_slot_id) {
        await client.query("update court_slots set status = 'open', hold_expires_at = null where id = $1", [booking.court_slot_id]);
      }
      await notifyInTx(client, {
        organizationId,
        recipientPhone: customer?.phone,
        type: "cancellation",
        message: `Your booking at ${venueName} has been cancelled by the venue. If you already paid, your refund is being processed.`,
      });
      return { booking: updated[0], message: "Booking cancelled and slot reopened" };
    }

    if (action === "reschedule") {
      if (!newDate || !newStartTime) throw httpError(400, "newDate and newStartTime are required");
      if (!booking.court_slot_id) throw httpError(409, "This booking has no slot to reschedule");

      const { rows: oldSlotRows } = await client.query("select * from court_slots where id = $1", [booking.court_slot_id]);
      const oldSlot = oldSlotRows[0];
      const endTime = newEndTime || oldSlot?.end_time || newStartTime;

      // Lock the target slot (creating it if the grid hasn't been generated
      // that far out yet) so a concurrent booking on the same court/time
      // can't collide with this reschedule.
      const { rows: targetRows } = await client.query(
        "select * from court_slots where court_id = $1 and date = $2 and start_time = $3 for update",
        [booking.court_id, newDate, newStartTime]
      );
      let targetSlot = targetRows[0];

      if (targetSlot) {
        const isSameSlot = targetSlot.id === booking.court_slot_id;
        if (!isSameSlot && targetSlot.status !== "open") {
          throw httpError(409, "The requested new slot is not available");
        }
      } else {
        const { rows: created } = await client.query(
          `insert into court_slots (court_id, venue_id, organization_id, date, start_time, end_time, price, status)
           values ($1, $2, $3, $4, $5, $6, $7, 'open') returning *`,
          [booking.court_id, booking.venue_id, organizationId, newDate, newStartTime, endTime, oldSlot?.price ?? booking.total_amount]
        );
        targetSlot = created[0];
      }

      await client.query("update court_slots set status = 'booked', hold_expires_at = null where id = $1", [targetSlot.id]);
      if (oldSlot && oldSlot.id !== targetSlot.id) {
        await client.query("update court_slots set status = 'open', hold_expires_at = null where id = $1", [oldSlot.id]);
      }

      const { rows: updated } = await client.query(
        "update bookings set court_slot_id = $1, notes = 'Rescheduled by owner', updated_at = now() where id = $2 returning *",
        [targetSlot.id, bookingId]
      );
      await notifyInTx(client, {
        organizationId,
        recipientPhone: customer?.phone,
        type: "reschedule",
        message: `Your booking at ${venueName} was rescheduled by the venue to ${newDate} (${newStartTime} - ${endTime}).`,
      });
      return {
        booking: { ...updated[0], date: newDate, start_time: newStartTime, end_time: endTime },
        message: "Booking rescheduled",
      };
    }

    throw httpError(400, "Invalid action");
  });
}

// ===========================================================================
// Customer CRM
// ===========================================================================

export async function listCustomers(sql, organizationId) {
  return sql`
    select *, total_bookings as booking_count, last_booking_at as last_booking_date
    from customers where organization_id = ${organizationId} order by total_spend desc
  `;
}

// ===========================================================================
// UPI verification queue
// ===========================================================================

export async function listPendingUpi(sql, organizationId, venueId) {
  const venueClause = venueId ? sql`and b.venue_id = ${venueId}` : sql``;
  return sql`
    select b.*, cs.date, cs.start_time, cs.end_time,
           c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
           crt.name as court_name, v.name as venue_name, v.upi_id as venue_upi_id, v.upi_name as venue_upi_name
    from bookings b
    join court_slots cs on b.court_slot_id = cs.id
    left join customers c on b.customer_id = c.id
    left join courts crt on b.court_id = crt.id
    left join venues v on b.venue_id = v.id
    where b.organization_id = ${organizationId} and b.payment_status = 'pending_verification' ${venueClause}
    order by b.created_at desc
  `;
}

export async function verifyUpiPayment(env, organizationId, bookingId, { action = "verify_credit", notes = "" }) {
  return withTransaction(env, async (client) => {
    const { rows } = await client.query("select * from bookings where id = $1 and organization_id = $2 for update", [bookingId, organizationId]);
    const booking = rows[0];
    if (!booking) throw httpError(404, "Booking not found");

    const { rows: customerRows } = await client.query("select * from customers where id = $1", [booking.customer_id]);
    const { rows: venueRows } = await client.query("select name from venues where id = $1", [booking.venue_id]);
    const customer = customerRows[0];
    const venueName = venueRows[0]?.name || "the venue";

    if (action === "verify_credit") {
      const { rows: updated } = await client.query(
        `update bookings set payment_status = 'paid', status = 'confirmed', amount_paid = total_amount,
           notes = coalesce(notes || ' | ', '') || 'Bank credit verified by owner', updated_at = now()
         where id = $1 returning *`,
        [bookingId]
      );
      await client.query("update payments set status = 'captured' where booking_id = $1", [bookingId]);
      // Customer CRM stats (total_spend/total_bookings) were already
      // incremented when the booking was confirmed in bookings.js — this
      // step only flips the verification status, it doesn't re-count.
      await notifyInTx(client, {
        organizationId,
        recipientPhone: customer?.phone,
        type: "payment_confirmation",
        message: `Your payment of ₹${booking.total_amount} (UTR: ${booking.upi_utr || "direct"}) has been verified by ${venueName}. Your slot is 100% confirmed!`,
      });
      return { status: "paid", booking: updated[0], message: "UPI payment verified and credited to venue" };
    }

    if (action === "reject") {
      const reason = notes || "Payment not received in owner UPI bank account";
      const { rows: updated } = await client.query(
        "update bookings set payment_status = 'failed', status = 'cancelled', notes = $2, updated_at = now() where id = $1 returning *",
        [bookingId, reason]
      );
      if (booking.court_slot_id) {
        await client.query("update court_slots set status = 'open', hold_expires_at = null where id = $1", [booking.court_slot_id]);
      }
      await client.query("update payments set status = 'failed' where booking_id = $1", [bookingId]);
      await notifyInTx(client, {
        organizationId,
        recipientPhone: customer?.phone,
        type: "cancellation",
        message: `Your booking at ${venueName} was not verified. Reason: ${reason}. The slot has been released.`,
      });
      return { status: "rejected", booking: updated[0], message: "Booking rejected and slot released back to open" };
    }

    throw httpError(400, "Invalid verification action");
  });
}

// ===========================================================================
// Business profile save (translates the dashboard's snake_case payload)
// ===========================================================================

export async function updateVenueProfile(sql, organizationId, venueId, body) {
  const venue = await updateVenue(sql, organizationId, venueId, {
    name: body.name,
    description: body.description,
    address: body.address,
    city: body.city,
    pincode: body.pincode,
    gstin: body.gstin,
    businessType: body.business_type,
    rules: body.rules,
    lat: body.lat,
    lng: body.lng,
    phone: body.phone,
    email: body.email,
    amenities: body.amenities,
    openTime: body.open_time ?? body.openTime,
    closeTime: body.close_time ?? body.closeTime,
    upiId: body.upi_id,
    upiName: body.upi_name,
    upiQrImage: body.upi_qr_image,
    // A new venue defaults to 'draft' (see createVenue) and there was
    // previously no way to flip it — it simply never showed up on the
    // marketplace or even its own direct link. updateVenue's `??` means
    // omitting this leaves the current status untouched, so a routine
    // profile save never accidentally un-publishes an active venue.
    status: body.status,
  });

  if (body.organization_name) {
    await sql`update organizations set name = ${body.organization_name} where id = ${organizationId}`;
  }

  return venue;
}

export async function getVenueProfile(sql, organizationId, venueId) {
  const venue = await getVenueForOrg(sql, organizationId, venueId);
  const [organization] = await sql`select name from organizations where id = ${organizationId}`;
  const courts = await listCourtsForVenue(sql, organizationId, venueId);
  return { ...venue, organization_name: organization?.name || "", courts };
}

// ===========================================================================
// Full-slot inquiries — a player/team offering to book an open game's slot
// outright, displacing the individual sign-ups (see requestFullSlot in
// services/games.js, which raises the request this responds to).
// ===========================================================================

export async function convertSlotToFullInquiry(env, organizationId, slotId, { clientName, clientPhone, amount, paymentMode = "cash", notes = "" }) {
  if (!clientName || !clientPhone) throw httpError(400, "Client name and phone number are required");

  return withTransaction(env, async (client) => {
    const { rows: slotRows } = await client.query(
      "select * from court_slots where id = $1 and organization_id = $2 for update",
      [slotId, organizationId]
    );
    const slot = slotRows[0];
    if (!slot) throw httpError(404, "Slot not found");

    const { rows: venueRows } = await client.query("select name, phone from venues where id = $1", [slot.venue_id]);
    const { rows: courtRows } = await client.query("select name from courts where id = $1", [slot.court_id]);
    const venueName = venueRows[0]?.name || "the venue";
    const venuePhone = venueRows[0]?.phone;
    const courtName = courtRows[0]?.name || "the court";

    const { rows: gameRows } = await client.query(
      "select * from games where court_slot_id = $1 and status in ('open', 'confirmed') for update",
      [slotId]
    );
    const game = gameRows[0];
    let registeredPlayersCount = 0;

    if (game) {
      const { rows: displacedPlayers } = await client.query(
        "select gp.*, c.name, c.phone from game_participants gp join customers c on gp.customer_id = c.id where gp.game_id = $1",
        [game.id]
      );
      registeredPlayersCount = displacedPlayers.length;
      await client.query("update games set status = 'converted_to_full_booking' where id = $1", [game.id]);
      await client.query("update game_participants set payment_status = 'refunded' where game_id = $1", [game.id]);

      for (const player of displacedPlayers) {
        await notifyInTx(client, {
          organizationId,
          recipientPhone: player.phone,
          type: "full_inquiry_refund",
          message: `Hi ${player.name}! Your open pickup game at ${venueName} on ${slot.date} (${slot.start_time} - ${slot.end_time}) on ${courtName} was booked in full by an exclusive private team. Your registration fee of ₹${player.share_amount} has been 100% refunded. Contact ${venueName} at ${venuePhone || "the venue"} for any queries.`,
        });
      }
    }

    const bookingAmount = Number(amount) || slot.price;
    const customer = await findOrCreateCustomerInTx(client, organizationId, { name: clientName, phone: clientPhone });

    const { rows: bookingRows } = await client.query(
      `insert into bookings (organization_id, venue_id, court_id, court_slot_id, customer_id, source, status, payment_status, total_amount, amount_paid, notes)
       values ($1, $2, $3, $4, $5, 'full_time_inquiry', 'confirmed', 'paid', $6, $6, $7) returning *`,
      [
        organizationId, slot.venue_id, slot.court_id, slot.id, customer.id, bookingAmount,
        `Full-time inquiry converted by owner. Client: ${clientName} (${clientPhone}).${
          registeredPlayersCount > 0 ? ` Replaced open game with ${registeredPlayersCount} registered player(s).` : ""
        } ${notes}`.trim(),
      ]
    );

    await recordCustomerBookingInTx(client, customer.id, bookingAmount);

    await client.query(
      `update court_slots set status = 'booked', hold_expires_at = null, price = $1,
         full_inquiry_client = $2, full_inquiry_phone = $3, full_inquiry_notes = $4, full_inquiry_status = 'accepted'
       where id = $5`,
      [bookingAmount, clientName, clientPhone, notes, slot.id]
    );

    await notifyInTx(client, {
      organizationId,
      recipientPhone: clientPhone,
      type: "booking_confirmation",
      message: `Dear ${clientName}, your full pitch booking at ${venueName} (${courtName}) for ${slot.date} from ${slot.start_time} to ${slot.end_time} is confirmed! Amount: ₹${bookingAmount}.`,
    });

    return {
      bookingId: bookingRows[0].id,
      registeredPlayersCount,
      message: `Full-time inquiry accepted! Pitch booked exclusively for ${clientName}.${
        registeredPlayersCount > 0 ? ` ${registeredPlayersCount} registered player(s) marked as refunded.` : ""
      }`,
    };
  });
}

export async function declineSlotInquiry(sql, organizationId, slotId) {
  const [updated] = await sql`
    update court_slots set full_inquiry_status = 'declined'
    where id = ${slotId} and organization_id = ${organizationId}
    returning *
  `;
  if (!updated) throw httpError(404, "Slot not found");

  if (updated.full_inquiry_phone) {
    const [venue] = await sql`select name from venues where id = ${updated.venue_id}`;
    await notify(sql, {
      organizationId,
      recipientPhone: updated.full_inquiry_phone,
      type: "notice",
      message: `Hello ${updated.full_inquiry_client || "there"}, your full slot booking request for ${updated.date} (${updated.start_time} - ${updated.end_time}) was declined by ${venue?.name || "the venue"} — the community pickup game remains active. Please explore other available slots on NexusPlay.`,
    });
  }

  return {
    slot: updated,
    message: "Full slot booking request declined. The community pickup session remains active.",
  };
}
