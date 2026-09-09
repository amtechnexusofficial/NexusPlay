import { httpError } from "../errors.js";
import { withTransaction } from "../db.js";
import { findOrCreateCustomerInTx } from "./customers.js";
import { notifyInTx, notify } from "./notifications.js";

// Public discovery feed: every open or filling-up pickup game, enriched
// with venue/court/sport display fields and its current roster.
export async function listGames(sql, { sportId, venueId, date } = {}) {
  // Scalar params + inline null-checks, not composed empty sql`` fragments
  // (see venues.js listPublicVenues for why — same fix, same reason: the
  // Open Games Hub's default call here has all three filters undefined,
  // hitting the exact "everything empty" case that broke the marketplace.
  const sportIdParam = sportId || null;
  const venueIdParam = venueId || null;
  const dateParam = date || null;

  const games = await sql`
    select g.*, cs.date, cs.start_time, cs.end_time,
           v.name as venue_name, v.address as venue_address, v.photos as venue_photos,
           v.upi_id as venue_upi_id, v.upi_name as venue_upi_name,
           c.name as court_name, sp.name as sport_name, sp.icon as sport_icon,
           oc.name as organizer_name, oc.phone as organizer_phone,
           g.capacity as required_players, g.price_per_player as cost_per_player,
           (select count(*)::int from game_participants gp where gp.game_id = g.id) as current_players
    from games g
    join court_slots cs on g.court_slot_id = cs.id
    join venues v on g.venue_id = v.id
    join courts c on g.court_id = c.id
    join sports sp on g.sport_id = sp.id
    left join customers oc on g.organizer_customer_id = oc.id
    where g.status in ('open', 'confirmed')
      and (${sportIdParam}::uuid is null or g.sport_id = ${sportIdParam}::uuid)
      and (${venueIdParam}::uuid is null or g.venue_id = ${venueIdParam}::uuid)
      and (${dateParam}::date is null or cs.date = ${dateParam}::date)
    order by cs.date asc, cs.start_time asc
  `;
  if (games.length === 0) return [];

  const gameIds = games.map((g) => g.id);
  const participants = await sql`
    select gp.*, c.name, c.phone
    from game_participants gp join customers c on gp.customer_id = c.id
    where gp.game_id = any(${gameIds})
  `;
  const byGame = {};
  for (const p of participants) {
    (byGame[p.game_id] ||= []).push(p);
  }
  return games.map((g) => ({ ...g, participants: byGame[g.id] || [] }));
}

// Organizer picks a slot and puts it up as an open game — other players
// can join individual spots until it fills, or an owner can later convert
// it into an exclusive full-pitch booking (see convertSlotToFullInquiry).
// No auth on this route (mirrors booking hold/confirm) — organizerName/
// organizerPhone identify the caller the same way a booking's customer
// details do.
export async function createGame(env, input) {
  const {
    venueId, courtId, sportId, title, organizerName, organizerPhone,
    skillLevel = "All Levels", requiredPlayers, costPerPlayer, date, startTime, endTime, rules, courtSlotId,
  } = input;

  if (!venueId || !courtId || !sportId || !organizerName || !organizerPhone || !requiredPlayers || !costPerPlayer || !date || !startTime) {
    throw httpError(400, "Missing required game fields");
  }

  return withTransaction(env, async (client) => {
    const { rows: venueRows } = await client.query("select * from venues where id = $1", [venueId]);
    const venue = venueRows[0];
    if (!venue) throw httpError(404, "Selected venue does not exist");

    // The owner "Host Open Game" form (and any other caller) sends a sport
    // slug like "badminton", not a uuid — sport_id is a uuid column, so
    // inserting the slug straight through fails with "invalid input syntax
    // for type uuid". Resolve slug-or-uuid the same way createCourt does.
    const { rows: sportRows } = await client.query(
      "select id from sports where id::text = $1 or slug = $1",
      [sportId]
    );
    const sport = sportRows[0];
    if (!sport) throw httpError(400, "Invalid sportId");
    const resolvedSportId = sport.id;

    let slot;
    if (courtSlotId) {
      const { rows } = await client.query("select * from court_slots where id = $1 for update", [courtSlotId]);
      slot = rows[0];
    }
    if (!slot) {
      const { rows } = await client.query(
        "select * from court_slots where court_id = $1 and date = $2 and start_time = $3 for update",
        [courtId, date, startTime]
      );
      slot = rows[0];
    }
    if (!slot) {
      const { rows } = await client.query(
        `insert into court_slots (court_id, venue_id, organization_id, date, start_time, end_time, price, status)
         values ($1, $2, $3, $4, $5, $6, $7, 'open') returning *`,
        [courtId, venueId, venue.organization_id, date, startTime, endTime || startTime, Number(costPerPlayer) * Number(requiredPlayers)]
      );
      slot = rows[0];
    }
    if (slot.status !== "open") throw httpError(409, "This slot is not available to host a game");

    const { rows: existing } = await client.query(
      "select id from games where court_slot_id = $1 and status in ('open', 'confirmed')",
      [slot.id]
    );
    if (existing[0]) throw httpError(409, "This slot already has an active open game");

    const organizer = await findOrCreateCustomerInTx(client, venue.organization_id, { name: organizerName, phone: organizerPhone });

    const { rows: gameRows } = await client.query(
      `insert into games (organization_id, venue_id, court_id, court_slot_id, organizer_customer_id, sport_id, title, starts_at, capacity, price_per_player, status, skill_level, rules)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', $11, $12) returning *`,
      [
        venue.organization_id, venueId, courtId, slot.id, organizer.id, resolvedSportId,
        title || `Open Game at ${venue.name}`, `${date}T${startTime}:00`,
        Number(requiredPlayers), Number(costPerPlayer), skillLevel, rules || null,
      ]
    );
    const game = gameRows[0];

    // The organizer takes the first spot automatically, already "paid" —
    // they're the one putting the slot up in the first place.
    await client.query(
      "insert into game_participants (game_id, customer_id, payment_status, share_amount) values ($1, $2, 'paid', $3)",
      [game.id, organizer.id, Number(costPerPlayer)]
    );

    return { gameId: game.id, slotId: slot.id };
  });
}

export async function joinGame(env, gameId, { playerName, playerPhone, utr }) {
  if (!playerName || !playerPhone) throw httpError(400, "Player name and phone are required");
  if (!utr || utr.trim().length < 8) throw httpError(400, "Enter the UPI transaction reference (UTR) after paying the venue's QR code");

  return withTransaction(env, async (client) => {
    const { rows } = await client.query("select * from games where id = $1 for update", [gameId]);
    const game = rows[0];
    if (!game) throw httpError(404, "Game not found");
    if (game.status !== "open") throw httpError(409, "Game is no longer open for joining");

    const { rows: countRows } = await client.query("select count(*)::int as n from game_participants where game_id = $1", [gameId]);
    if (countRows[0].n >= game.capacity) throw httpError(409, "Game is already full");

    const player = await findOrCreateCustomerInTx(client, game.organization_id, { name: playerName, phone: playerPhone });

    try {
      // pending_verification, not paid — matches every other UPI payment
      // in this app: no gateway holds the money, so it's not actually
      // confirmed until the owner checks their bank statement and
      // verifies it (see verifyUpiPayment / the owner's UPI queue).
      await client.query(
        "insert into game_participants (game_id, customer_id, payment_status, share_amount, upi_utr) values ($1, $2, 'pending_verification', $3, $4)",
        [gameId, player.id, game.price_per_player, utr.trim()]
      );
    } catch (err) {
      if (err.code === "23505") throw httpError(409, "You've already joined this game");
      throw err;
    }

    const { rows: newCountRows } = await client.query("select count(*)::int as n from game_participants where game_id = $1", [gameId]);
    const newPlayerCount = newCountRows[0].n;
    const isNowFull = newPlayerCount >= game.capacity;

    const { rows: updated } = await client.query("update games set status = $1 where id = $2 returning *", [
      isNowFull ? "confirmed" : "open",
      gameId,
    ]);

    if (isNowFull) {
      const { rows: organizerRows } = await client.query("select phone from customers where id = $1", [game.organizer_customer_id]);
      const { rows: slotRows } = await client.query("select date, start_time from court_slots where id = $1", [game.court_slot_id]);
      const slot = slotRows[0];
      await notifyInTx(client, {
        organizationId: game.organization_id,
        recipientPhone: organizerRows[0]?.phone,
        type: "confirmation",
        message: `Your game "${game.title}" is FULL! All ${game.capacity} player spots are filled and confirmed for ${slot?.date} at ${slot?.start_time}. Kickoff ready!`,
      });
    }

    return { newPlayerCount, isNowFull, game: updated[0] };
  });
}

// A player/team wants the whole pitch instead of a shared spot — flags the
// slot for the owner to review (see convertSlotToFullInquiry /
// declineSlotInquiry in services/owner.js). No auth, same as the rest of
// the booking-adjacent flow.
export async function requestFullSlot(sql, gameId, { clientName, clientPhone, amount, notes }) {
  if (!clientName || !clientPhone) throw httpError(400, "Client name and phone number are required.");

  const [game] = await sql`select * from games where id = ${gameId}`;
  if (!game) throw httpError(404, "Open game not found");

  const [slot] = await sql`select * from court_slots where id = ${game.court_slot_id}`;
  if (!slot) throw httpError(404, "Associated court slot not found");

  const [venue] = await sql`select name, phone from venues where id = ${game.venue_id}`;
  const [court] = await sql`select name from courts where id = ${game.court_id}`;
  const [{ n: registeredCount }] = await sql`select count(*)::int as n from game_participants where game_id = ${gameId}`;

  const offerAmount = Number(amount) || slot.price;

  await sql`
    update court_slots set
      full_inquiry_client = ${clientName},
      full_inquiry_phone = ${clientPhone},
      full_inquiry_notes = ${notes || ""},
      full_inquiry_amount = ${offerAmount},
      full_inquiry_status = 'pending',
      full_inquiry_requested_at = now()
    where id = ${slot.id}
  `;

  await notify(sql, {
    organizationId: game.organization_id,
    recipientPhone: venue?.phone,
    type: "full_slot_request",
    message: `Client ${clientName} (+91 ${clientPhone}) requested full booking for ${slot.date} (${slot.start_time} - ${slot.end_time}) on ${court?.name || "a court"}. Offer: ₹${offerAmount}. Currently ${registeredCount} player(s) registered. Review in the owner dashboard to accept and auto-refund players.`,
  });

  return {
    message: "Full slot booking request submitted to the venue owner for review.",
    slotId: slot.id,
    gameId,
    offerAmount,
  };
}

// Wired into the same Cron Trigger as sweepExpiredHolds (see index.js
// `scheduled` / wrangler.toml, runs every minute). The deal shown to
// players joining a spot is: the game is confirmed once every spot
// fills, or it's auto-cancelled and refunded if it hasn't filled by one
// hour before kickoff — an open game was otherwise able to sit "open"
// forever, silently taking players' money for a match that never
// actually locks in.
export async function sweepUnfilledGames(env) {
  return withTransaction(env, async (client) => {
    const { rows: games } = await client.query(
      `select g.*, cs.date, cs.start_time, cs.end_time, v.name as venue_name, v.phone as venue_phone
       from games g
       join court_slots cs on g.court_slot_id = cs.id
       join venues v on g.venue_id = v.id
       where g.status = 'open'
         and (cs.date::timestamp + cs.start_time::time) <= now() + interval '1 hour'`
    );
    if (games.length === 0) return { cancelled: 0 };

    for (const game of games) {
      const { rows: participants } = await client.query(
        `select gp.*, c.name, c.phone from game_participants gp join customers c on gp.customer_id = c.id where gp.game_id = $1`,
        [game.id]
      );

      await client.query("update games set status = 'cancelled' where id = $1", [game.id]);
      await client.query(
        "update game_participants set payment_status = 'refunded' where game_id = $1 and payment_status in ('paid', 'pending_verification')",
        [game.id]
      );
      await client.query("update court_slots set status = 'open', hold_expires_at = null where id = $1", [game.court_slot_id]);

      for (const p of participants) {
        await notifyInTx(client, {
          organizationId: game.organization_id,
          recipientPhone: p.phone,
          type: "cancellation",
          message: `"${game.title}" at ${game.venue_name} on ${game.date} didn't fill up in time and has been cancelled. The venue owes you a ₹${p.share_amount} refund via UPI.`,
        });
      }

      if (participants.length > 0) {
        const refundList = participants
          .map((p) => `${p.name || "Player"} (${p.phone}) ₹${p.share_amount}`)
          .join("; ");
        await notifyInTx(client, {
          organizationId: game.organization_id,
          recipientPhone: game.venue_phone,
          type: "cancellation",
          message: `Open game "${game.title}" (${game.date} ${game.start_time}-${game.end_time}) didn't fill up in time and was auto-cancelled. Please refund these ${participants.length} player(s) via UPI: ${refundList}.`,
        });
      }
    }

    return { cancelled: games.length };
  });
}
