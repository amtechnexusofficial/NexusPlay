// All the actual "product logic" lives here, independent of Hono/HTTP,
// so it's testable and so the cron handler can reuse it directly.

function serializeSlot(slotRow, players) {
  return {
    id: slotRow.id,
    turfId: slotRow.turf_id,
    date: slotRow.date,
    startTime: slotRow.start_time,
    endTime: slotRow.end_time,
    fullPrice: slotRow.full_price,
    minPlayers: slotRow.min_players,
    pricePerPlayer: slotRow.price_per_player,
    poolWindowMinutes: slotRow.pool_window_minutes,
    status: slotRow.status,
    poolDeadline: slotRow.pool_deadline,
    fullBooking: slotRow.full_booking,
    fullBookingRequest: slotRow.full_booking_request,
    joinedPlayers: players || [],
  };
}

export async function listSlotsForTurf(sql, turfId) {
  const slots = await sql`
    select * from slots where turf_id = ${turfId} order by date, start_time
  `;
  const slotIds = slots.map((s) => s.id);
  if (slotIds.length === 0) return [];
  const players = await sql`
    select * from joined_players
    where slot_id = any(${slotIds}) and status = 'confirmed'
    order by joined_at
  `;
  return slots.map((s) =>
    serializeSlot(
      s,
      players.filter((p) => p.slot_id === s.id)
    )
  );
}

export async function createSlot(sql, turfId, input) {
  const fullPrice = Number(input.fullPrice);
  const minPlayers = Number(input.minPlayers) || 8;
  const pricePerPlayer = Math.ceil(fullPrice / minPlayers);

  const [slot] = await sql`
    insert into slots (turf_id, date, start_time, end_time, full_price, min_players, price_per_player, pool_window_minutes)
    values (${turfId}, ${input.date}, ${input.startTime}, ${input.endTime}, ${fullPrice}, ${minPlayers}, ${pricePerPlayer}, ${input.poolWindowMinutes || 60})
    returning *
  `;
  return serializeSlot(slot, []);
}

// A player wants to join an individual (pooled) slot.
export async function joinSlot(sql, slotId, { name, phone }) {
  const [slot] = await sql`select * from slots where id = ${slotId}`;
  if (!slot) throw httpError(404, "Slot not found");
  if (!["open", "pooling"].includes(slot.status)) {
    throw httpError(409, `Slot is ${slot.status.replace("_", " ")} and can't accept new joiners`);
  }

  const isFirstJoiner = slot.status === "open";
  const deadline = isFirstJoiner
    ? new Date(Date.now() + slot.pool_window_minutes * 60 * 1000).toISOString()
    : slot.pool_deadline;

  const [player] = await sql`
    insert into joined_players (slot_id, name, phone, paid_amount)
    values (${slotId}, ${name}, ${phone}, ${slot.price_per_player})
    returning *
  `;

  const players = await sql`
    select * from joined_players where slot_id = ${slotId} and status = 'confirmed'
  `;

  const reachedThreshold = players.length >= slot.min_players;
  const newStatus = reachedThreshold ? "confirmed_pool" : "pooling";

  const [updated] = await sql`
    update slots
    set status = ${newStatus}, pool_deadline = ${deadline}
    where id = ${slotId}
    returning *
  `;

  await logActivity(sql, {
    turfId: slot.turf_id,
    slotId,
    message: reachedThreshold
      ? `Pool filled (${players.length}/${slot.min_players}) — slot confirmed automatically.`
      : `${name} joined (${players.length}/${slot.min_players}).`,
  });

  return serializeSlot(updated, players);
}

// A player/team wants to book the entire slot outright.
export async function bookFullSlot(sql, slotId, { name, phone }) {
  const [slot] = await sql`select * from slots where id = ${slotId}`;
  if (!slot) throw httpError(404, "Slot not found");

  if (slot.status === "open") {
    const fullBooking = { name, phone, amount: slot.full_price };
    const [updated] = await sql`
      update slots set status = 'confirmed_full', full_booking = ${JSON.stringify(fullBooking)}
      where id = ${slotId}
      returning *
    `;
    await logActivity(sql, {
      turfId: slot.turf_id,
      slotId,
      message: `${name} booked the full slot directly (₹${slot.full_price}).`,
    });
    return serializeSlot(updated, []);
  }

  if (slot.status === "pooling") {
    // Players already paid into the pool — can't silently bump them.
    // Owner has to decide. Store the request and surface it on the dashboard.
    const request = {
      id: crypto.randomUUID(),
      name,
      phone,
      amount: slot.full_price,
      requestedAt: new Date().toISOString(),
    };
    const [updated] = await sql`
      update slots set full_booking_request = ${JSON.stringify(request)}
      where id = ${slotId}
      returning *
    `;
    await logActivity(sql, {
      turfId: slot.turf_id,
      slotId,
      message: `${name} wants to book the full slot while it's mid-pool. Needs owner approval.`,
    });
    const players = await sql`
      select * from joined_players where slot_id = ${slotId} and status = 'confirmed'
    `;
    return { ...serializeSlot(updated, players), pendingApproval: true };
  }

  throw httpError(409, `Slot is ${slot.status.replace("_", " ")} and can't be booked`);
}

// Owner accepts a full-booking request that arrived mid-pool:
// refunds every pooled player, then confirms the full booking.
export async function acceptFullBookingRequest(sql, slotId) {
  const [slot] = await sql`select * from slots where id = ${slotId}`;
  if (!slot) throw httpError(404, "Slot not found");
  if (!slot.full_booking_request) throw httpError(409, "No pending full-booking request on this slot");

  const req = slot.full_booking_request;

  await sql`
    update joined_players set status = 'refunded'
    where slot_id = ${slotId} and status = 'confirmed'
  `;

  const [updated] = await sql`
    update slots
    set status = 'confirmed_full',
        full_booking = ${JSON.stringify({ name: req.name, phone: req.phone, amount: req.amount })},
        full_booking_request = null,
        pool_deadline = null
    where id = ${slotId}
    returning *
  `;

  await logActivity(sql, {
    turfId: slot.turf_id,
    slotId,
    message: `Owner accepted ${req.name}'s full-slot request. Pooled players refunded.`,
  });

  return serializeSlot(updated, []);
}

export async function declineFullBookingRequest(sql, slotId) {
  const [slot] = await sql`select * from slots where id = ${slotId}`;
  if (!slot) throw httpError(404, "Slot not found");

  const [updated] = await sql`
    update slots set full_booking_request = null where id = ${slotId} returning *
  `;
  await logActivity(sql, {
    turfId: slot.turf_id,
    slotId,
    message: `Owner declined a full-slot request. Pool continues.`,
  });
  const players = await sql`
    select * from joined_players where slot_id = ${slotId} and status = 'confirmed'
  `;
  return serializeSlot(updated, players);
}

export async function cancelSlotManually(sql, slotId) {
  const [slot] = await sql`select * from slots where id = ${slotId}`;
  if (!slot) throw httpError(404, "Slot not found");

  await sql`
    update joined_players set status = 'refunded' where slot_id = ${slotId} and status = 'confirmed'
  `;
  const [updated] = await sql`
    update slots
    set status = 'open', pool_deadline = null, full_booking = null, full_booking_request = null
    where id = ${slotId}
    returning *
  `;
  await logActivity(sql, {
    turfId: slot.turf_id,
    slotId,
    message: `Owner manually cancelled and reset this slot. Any pooled players refunded.`,
  });
  return serializeSlot(updated, []);
}

// Called every minute by the Worker's cron trigger.
// Finds pools whose deadline passed without hitting the player threshold,
// refunds everyone, and reopens the slot.
export async function checkPoolTimeouts(sql) {
  const expired = await sql`
    select * from slots
    where status = 'pooling' and pool_deadline is not null and pool_deadline <= now()
  `;

  for (const slot of expired) {
    const players = await sql`
      select * from joined_players where slot_id = ${slot.id} and status = 'confirmed'
    `;
    if (players.length >= slot.min_players) {
      // Safety net: threshold was actually hit but status wasn't updated. Confirm it.
      await sql`update slots set status = 'confirmed_pool' where id = ${slot.id}`;
      continue;
    }

    await sql`
      update joined_players set status = 'refunded' where slot_id = ${slot.id} and status = 'confirmed'
    `;
    await sql`
      update slots set status = 'open', pool_deadline = null where id = ${slot.id}
    `;
    await logActivity(sql, {
      turfId: slot.turf_id,
      slotId: slot.id,
      message: `Pool for ${slot.start_time}-${slot.end_time} missed its ${slot.min_players}-player threshold (had ${players.length}). Refunded and reopened.`,
    });
  }

  return expired.length;
}

export async function logActivity(sql, { turfId, slotId, message, meta }) {
  await sql`
    insert into activity_log (turf_id, slot_id, message, meta)
    values (${turfId}, ${slotId}, ${message}, ${meta ? JSON.stringify(meta) : null})
  `;
}

export async function listActivity(sql, limit = 50) {
  return sql`select * from activity_log order by at desc limit ${limit}`;
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
