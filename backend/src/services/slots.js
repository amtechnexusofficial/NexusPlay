import { httpError } from "../errors.js";

function timeToMinutes(hhmm) {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isPeakTime(startMinutes, peakHours) {
  if (!Array.isArray(peakHours)) return false;
  return peakHours.some((range) => {
    if (!range?.from || !range?.to) return false;
    return startMinutes >= timeToMinutes(range.from) && startMinutes < timeToMinutes(range.to);
  });
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

// Neon may return `date` as "YYYY-MM-DD", a Date, or an ISO timestamp.
// Always normalize to YYYY-MM-DD before comparing against start_time.
function toDateOnly(date) {
  if (!date) return null;
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    // DATE columns arrive as UTC midnight; take the UTC calendar day so
    // we don't shift into the previous IST day.
    return date.toISOString().slice(0, 10);
  }
  const match = String(date).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function toHhmm(startTime) {
  if (!startTime) return null;
  if (typeof startTime === "string") return startTime.slice(0, 5);
  // Rare: some drivers return a Date/time object for TIME columns.
  if (startTime instanceof Date && !Number.isNaN(startTime.getTime())) {
    return startTime.toISOString().slice(11, 16);
  }
  const match = String(startTime).match(/(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

// Venues are India-based; Workers run in UTC. Slot dates/times are stored
// without a timezone, so interpret them as Asia/Kolkata when deciding
// whether a start time has already passed.
export function isSlotStartInPast(date, startTime, now = new Date()) {
  const day = toDateOnly(date);
  const hhmm = toHhmm(startTime);
  if (!day || !hhmm) return false;
  const ms = Date.parse(`${day}T${hhmm}:00+05:30`);
  return Number.isFinite(ms) && ms <= now.getTime();
}

export function filterCurrentSlots(slots, now = new Date()) {
  return (slots || []).filter((s) => !isSlotStartInPast(s.date, s.start_time, now));
}

// Shared core: builds and inserts the slot grid for a given venue on an
// explicit list of dates. Steps by each court's own slot duration (not a
// fixed hour), so 30/90/custom-minute courts don't produce overlapping
// slots. Idempotent: `on conflict do nothing` against the (court_id, date,
// start_time) unique constraint means calling this repeatedly is safe.
// Returns the number of new slot rows actually inserted (0 is a real,
// informative answer — e.g. the court's own open/close times leave no
// room for even one slot).
async function generateSlotsForDates(sql, venueId, dates) {
  const [venue] = await sql`select * from venues where id = ${venueId}`;
  if (!venue) return 0;
  const courts = await sql`select * from courts where venue_id = ${venueId} and status = 'active'`;
  if (courts.length === 0) return 0;

  const rows = [];
  for (const date of dates) {
    const isWeekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

    for (const court of courts) {
      const openMinutes = timeToMinutes(court.open_time || venue.open_time);
      const closeMinutes = timeToMinutes(court.close_time || venue.close_time);
      const duration = court.slot_duration_minutes || 60;

      for (let start = openMinutes; start + duration <= closeMinutes; start += duration) {
        let price = court.base_price;
        if (isWeekend && court.weekend_price) {
          price = court.weekend_price;
        } else if (court.peak_price && isPeakTime(start, court.peak_hours)) {
          price = court.peak_price;
        }
        rows.push({
          courtId: court.id,
          venueId,
          organizationId: venue.organization_id,
          date,
          startTime: minutesToTime(start),
          endTime: minutesToTime(start + duration),
          price,
        });
      }
    }
  }

  if (rows.length === 0) return 0;

  // One insert-per-row (the previous approach) sends one HTTP subrequest
  // per row through Neon's HTTP driver — a venue with a few courts and a
  // full day's hours easily needs 50-100+ rows for even a single date,
  // and Cloudflare Workers caps subrequests per invocation ("Too many
  // subrequests by single Worker invocation"). unnest() turns the whole
  // batch into one INSERT, so it's one subrequest regardless of row count.
  const result = await sql`
    insert into court_slots (court_id, venue_id, organization_id, date, start_time, end_time, price, status)
    select * from unnest(
      ${rows.map((r) => r.courtId)}::uuid[],
      ${rows.map((r) => r.venueId)}::uuid[],
      ${rows.map((r) => r.organizationId)}::uuid[],
      ${rows.map((r) => r.date)}::date[],
      ${rows.map((r) => r.startTime)}::text[],
      ${rows.map((r) => r.endTime)}::text[],
      ${rows.map((r) => r.price)}::int[],
      ${rows.map(() => "open")}::text[]
    )
    on conflict (court_id, date, start_time) do nothing
    returning id
  `;
  return result.length;
}

export async function generateSlotsForNextDays(sql, venueId, daysCount = 14) {
  const today = new Date();
  const dates = [];
  for (let d = 0; d < daysCount; d++) {
    const curDate = new Date(today);
    curDate.setDate(today.getDate() + d);
    dates.push(dateStr(curDate));
  }
  return generateSlotsForDates(sql, venueId, dates);
}

// Manual trigger for a single, explicit date — the escape hatch for when
// the automatic 7-day rolling window (from listLiveSlots) doesn't cover
// the date an owner is looking at (browsing further out than a week,
// server/local date-boundary edge cases around midnight, or a court that
// was only just added). Also doubles as a direct diagnostic: 0 slots
// inserted for a date that should clearly have some means the court's
// open/close times (or its venue fallback) don't leave room for even one
// slot, not a display bug.
export async function generateSlotsForDate(sql, organizationId, venueId, date) {
  if (!date) throw httpError(400, "date is required");
  const [venue] = await sql`select id from venues where id = ${venueId} and organization_id = ${organizationId}`;
  if (!venue) throw httpError(404, "Venue not found");
  const inserted = await generateSlotsForDates(sql, venueId, [date]);
  return { date, slotsCreated: inserted };
}

// Owner changed a court's operating hours or slot duration/interval in
// the Courts tab — existing slot rows don't retroactively change
// (generateSlotsForDates only fills gaps via "on conflict do nothing"),
// so switching e.g. 60-minute slots to 30-minute ones would otherwise
// leave the old 60-minute grid sitting there untouched alongside new
// 30-minute slots wherever a gap happened to exist. This clears the
// grid out first for the given window — only 'open' rows; a booked,
// held, or intentionally blocked slot is never touched — and rebuilds
// it from the court's current settings.
export async function regenerateSlotsForCourt(sql, organizationId, courtId, days = 7) {
  const [court] = await sql`select * from courts where id = ${courtId} and organization_id = ${organizationId}`;
  if (!court) throw httpError(404, "Court not found");
  const [venue] = await sql`select * from venues where id = ${court.venue_id}`;

  const today = new Date();
  const dates = [];
  for (let d = 0; d < days; d++) {
    const cur = new Date(today);
    cur.setDate(today.getDate() + d);
    dates.push(dateStr(cur));
  }
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const [{ n: keptBooked }] = await sql`
    select count(*)::int as n from court_slots
    where court_id = ${courtId} and date between ${startDate} and ${endDate} and status in ('booked', 'held')
  `;

  const removed = await sql`
    delete from court_slots
    where court_id = ${courtId} and date between ${startDate} and ${endDate} and status = 'open'
    returning id
  `;

  const openMinutes = timeToMinutes(court.open_time || venue.open_time);
  const closeMinutes = timeToMinutes(court.close_time || venue.close_time);
  const duration = court.slot_duration_minutes || 60;

  const rows = [];
  for (const date of dates) {
    const isWeekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    for (let start = openMinutes; start + duration <= closeMinutes; start += duration) {
      let price = court.base_price;
      if (isWeekend && court.weekend_price) {
        price = court.weekend_price;
      } else if (court.peak_price && isPeakTime(start, court.peak_hours)) {
        price = court.peak_price;
      }
      rows.push({
        date,
        startTime: minutesToTime(start),
        endTime: minutesToTime(start + duration),
        price,
      });
    }
  }

  let inserted = 0;
  if (rows.length > 0) {
    const result = await sql`
      insert into court_slots (court_id, venue_id, organization_id, date, start_time, end_time, price, status)
      select ${courtId}::uuid, ${court.venue_id}::uuid, ${organizationId}::uuid, *, 'open'::text from unnest(
        ${rows.map((r) => r.date)}::date[],
        ${rows.map((r) => r.startTime)}::text[],
        ${rows.map((r) => r.endTime)}::text[],
        ${rows.map((r) => r.price)}::int[]
      )
      on conflict (court_id, date, start_time) do nothing
      returning id
    `;
    inserted = result.length;
  }

  return { removed: removed.length, inserted, keptBooked, days };
}

export async function listSlots(sql, venueId, { date, courtId } = {}) {
  const queryDate = date || dateStr(new Date());

  // Keep the "not yet started" rule in SQL (Asia/Kolkata) so Neon date/time
  // driver quirks can't silently leave expired morning slots visible.
  // For a future queryDate the first OR branch is true and every slot that
  // day is returned; for today only start_time > now remains.
  // Select only fields the public turf grid needs (not full s.* / hold columns).
  const fetch = () =>
    courtId
      ? sql`
          select s.id, s.court_id, s.venue_id, s.date, s.start_time, s.end_time,
                 s.price, s.status, s.block_reason,
                 c.name as court_name, c.sport_id, sp.slug as sport_slug
          from court_slots s
          join courts c on s.court_id = c.id
          join sports sp on c.sport_id = sp.id
          where s.venue_id = ${venueId} and s.date = ${queryDate} and s.court_id = ${courtId}
            and (
              ${queryDate}::date > (timezone('Asia/Kolkata', now()))::date
              or (
                ${queryDate}::date = (timezone('Asia/Kolkata', now()))::date
                and s.start_time::time > (timezone('Asia/Kolkata', now()))::time
              )
            )
          order by s.start_time asc`
      : sql`
          select s.id, s.court_id, s.venue_id, s.date, s.start_time, s.end_time,
                 s.price, s.status, s.block_reason,
                 c.name as court_name, c.sport_id, sp.slug as sport_slug
          from court_slots s
          join courts c on s.court_id = c.id
          join sports sp on c.sport_id = sp.id
          where s.venue_id = ${venueId} and s.date = ${queryDate}
            and (
              ${queryDate}::date > (timezone('Asia/Kolkata', now()))::date
              or (
                ${queryDate}::date = (timezone('Asia/Kolkata', now()))::date
                and s.start_time::time > (timezone('Asia/Kolkata', now()))::time
              )
            )
          order by c.name asc, s.start_time asc`;

  let slots = await fetch();
  // Previously: empty after past-filter triggered generateSlotsForNextDays(14),
  // which was multi-second and often useless (today's slots already existed but
  // were all in the past). Only generate the requested date, and only when that
  // date has zero rows at all.
  if (slots.length === 0) {
    const existing = courtId
      ? await sql`
          select 1 as ok from court_slots
          where venue_id = ${venueId} and date = ${queryDate} and court_id = ${courtId}
          limit 1`
      : await sql`
          select 1 as ok from court_slots
          where venue_id = ${venueId} and date = ${queryDate}
          limit 1`;
    if (existing.length === 0) {
      await generateSlotsForDates(sql, venueId, [queryDate]);
      slots = await fetch();
    }
  }
  if (slots.length === 0) return slots;

  // A slot can have an open pickup game on it while court_slots.status is
  // still 'open' (it isn't fully booked yet) — without this, a player
  // browsing the venue page directly (instead of Open Games Hub) has no
  // way to know 4/8 people already joined, and could instant-book the
  // whole slot out from under them via holdSlot (see the matching guard
  // added there).
  const games = await sql`
    select g.id, g.court_slot_id, g.title, g.capacity as required_players,
           g.price_per_player as cost_per_player,
           (select count(*)::int from game_participants gp where gp.game_id = g.id) as current_players
    from games g
    where g.venue_id = ${venueId} and g.status in ('open', 'confirmed')
      and g.court_slot_id = any(${slots.map((s) => s.id)})
  `;
  const gameBySlot = {};
  for (const g of games) gameBySlot[g.court_slot_id] = g;

  // JS backstop in case a driver returns odd date/time shapes.
  return filterCurrentSlots(slots.map((s) => ({ ...s, game: gameBySlot[s.id] || null })));
}

export async function getSlotOrThrow(sql, slotId) {
  const [slot] = await sql`select * from court_slots where id = ${slotId}`;
  if (!slot) throw httpError(404, "Slot not found");
  return slot;
}

// ===========================================================================
// Owner slot management (block/unblock/price) — every mutation is scoped
// to the caller's organization so an owner can never touch another
// tenant's slot by guessing an id.
// ===========================================================================

export async function blockSlot(sql, organizationId, { slotId, courtId, venueId, date, startTime, endTime, reason = "Maintenance" }) {
  if (slotId) {
    const [updated] = await sql`
      update court_slots set status = 'blocked', block_reason = ${reason}
      where id = ${slotId} and organization_id = ${organizationId}
      returning *
    `;
    if (!updated) throw httpError(404, "Slot not found");
    return updated;
  }

  if (courtId && venueId && date && startTime) {
    const [court] = await sql`select id from courts where id = ${courtId} and organization_id = ${organizationId}`;
    if (!court) throw httpError(404, "Court not found");
    const [row] = await sql`
      insert into court_slots (court_id, venue_id, organization_id, date, start_time, end_time, price, status, block_reason)
      values (${courtId}, ${venueId}, ${organizationId}, ${date}, ${startTime}, ${endTime || startTime}, 0, 'blocked', ${reason})
      on conflict (court_id, date, start_time) do update set status = 'blocked', block_reason = ${reason}
      returning *
    `;
    return row;
  }

  throw httpError(400, "slotId, or courtId+venueId+date+startTime, is required");
}

// The dashboard's "Unblock" button sends courtId+date+startTime (it never
// looked up the slot id), so accept either that or a direct slotId.
export async function unblockSlot(sql, organizationId, { slotId, courtId, date, startTime }) {
  const [updated] = slotId
    ? await sql`
        update court_slots set status = 'open', block_reason = null
        where id = ${slotId} and organization_id = ${organizationId} and status = 'blocked'
        returning *
      `
    : await sql`
        update court_slots set status = 'open', block_reason = null
        where court_id = ${courtId} and date = ${date} and start_time = ${startTime}
          and organization_id = ${organizationId} and status = 'blocked'
        returning *
      `;
  if (!updated) throw httpError(404, "Blocked slot not found");
  return updated;
}

// Distinct from blockSlot — blocking keeps the slot visible (as
// "blocked") so the owner remembers why it's off the grid; this actually
// removes the row, for a slot that shouldn't have existed at all (e.g.
// generated outside real operating hours). Guarded to 'open'/'blocked'/
// 'maintenance' only — court_slots cascades to bookings and games on
// delete, so a 'booked' or 'held' slot is refused rather than silently
// wiping a real booking or an active pickup game.
export async function deleteSlot(sql, organizationId, slotId) {
  const [slot] = await sql`select * from court_slots where id = ${slotId} and organization_id = ${organizationId}`;
  if (!slot) throw httpError(404, "Slot not found");
  if (!["open", "blocked", "maintenance"].includes(slot.status)) {
    throw httpError(409, `Cannot remove a slot that is ${slot.status} — cancel the booking first`);
  }
  const [activeGame] = await sql`select id from games where court_slot_id = ${slotId} and status in ('open', 'confirmed')`;
  if (activeGame) throw httpError(409, "Cannot remove a slot with an active open game — cancel the game first");
  await sql`delete from court_slots where id = ${slotId}`;
  return { ok: true };
}

export async function updateSlotPrice(sql, organizationId, slotId, price) {
  if (!Number.isFinite(price) || price < 0) throw httpError(400, "A valid price is required");
  const [updated] = await sql`
    update court_slots set price = ${price}
    where id = ${slotId} and organization_id = ${organizationId}
    returning *
  `;
  if (!updated) throw httpError(404, "Slot not found");
  return updated;
}

// Owner's interactive day view: the slot grid for one venue/date, each
// slot enriched with its booking (if any). Ensures the grid exists first.
export async function listLiveSlots(sql, organizationId, venueId, date) {
  const targetDate = date || dateStr(new Date());
  await generateSlotsForNextDays(sql, venueId, 7);

  const slots = await sql`
    select cs.*, c.name as court_name, sp.slug as sport_id, c.capacity as court_capacity,
           c.base_price, c.peak_price, c.weekend_price
    from court_slots cs
    join courts c on cs.court_id = c.id
    join sports sp on c.sport_id = sp.id
    where cs.organization_id = ${organizationId} and cs.venue_id = ${venueId} and cs.date = ${targetDate}
    order by c.name asc, cs.start_time asc
  `;

  const bookings = await sql`
    select b.id, b.court_slot_id, b.customer_id, b.total_amount, b.amount_paid, b.status, b.payment_status,
           b.source, b.notes, c.name as customer_name, c.phone as customer_phone
    from bookings b
    join court_slots cs on b.court_slot_id = cs.id
    left join customers c on b.customer_id = c.id
    where b.organization_id = ${organizationId} and b.venue_id = ${venueId} and cs.date = ${targetDate}
  `;
  const bookingBySlot = {};
  for (const b of bookings) {
    if (b.court_slot_id) bookingBySlot[b.court_slot_id] = b;
  }

  // Open/confirmed pickup games on this venue's slots — the owner dashboard
  // shows "4/8 joined" and, when reviewing a full-slot inquiry, needs each
  // registered player's name + phone so the owner knows who to actually
  // refund (there's no payment gateway holding this money to auto-refund).
  const games = await sql`
    select g.*, g.capacity as required_players, g.price_per_player as cost_per_player
    from games g
    join court_slots cs on g.court_slot_id = cs.id
    where g.organization_id = ${organizationId} and g.venue_id = ${venueId} and cs.date = ${targetDate}
      and g.status in ('open', 'confirmed')
  `;
  const gameBySlot = {};
  for (const g of games) gameBySlot[g.court_slot_id] = g;

  if (games.length > 0) {
    const gameIds = games.map((g) => g.id);
    const participants = await sql`
      select gp.game_id, gp.share_amount, c.name, c.phone
      from game_participants gp
      join customers c on gp.customer_id = c.id
      where gp.game_id = any(${gameIds})
      order by gp.joined_at asc
    `;
    const participantsByGame = {};
    for (const p of participants) {
      (participantsByGame[p.game_id] ||= []).push(p);
    }
    for (const g of games) {
      g.current_players = (participantsByGame[g.id] || []).length;
      g.participants = participantsByGame[g.id] || [];
    }
  }

  return {
    date: targetDate,
    venueId,
    // Hide past open/blocked slots (nothing left to sell), but keep past
    // booked/held ones so the owner can still see today's completed activity.
    slots: slots
      .map((s) => ({
        ...s,
        booking: bookingBySlot[s.id] || null,
        game: gameBySlot[s.id] || null,
      }))
      .filter((s) => {
        if (!isSlotStartInPast(s.date, s.start_time)) return true;
        return s.status === "booked" || s.status === "held" || !!s.booking || !!s.game;
      }),
  };
}
