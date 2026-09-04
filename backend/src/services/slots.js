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

// Generates the slot grid for the next `daysCount` days for every active
// court in a venue. Steps by each court's own slot duration (not a fixed
// hour), so 30/90/custom-minute courts don't produce overlapping slots.
// Idempotent: `on conflict do nothing` against the (court_id, date,
// start_time) unique constraint means calling this repeatedly is safe.
export async function generateSlotsForNextDays(sql, venueId, daysCount = 14) {
  const [venue] = await sql`select * from venues where id = ${venueId}`;
  if (!venue) return;
  const courts = await sql`select * from courts where venue_id = ${venueId} and status = 'active'`;
  if (courts.length === 0) return;

  const today = new Date();
  const rows = [];

  for (let d = 0; d < daysCount; d++) {
    const curDate = new Date(today);
    curDate.setDate(today.getDate() + d);
    const date = dateStr(curDate);
    const isWeekend = curDate.getDay() === 0 || curDate.getDay() === 6;

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

  // Neon's HTTP client doesn't support a multi-row batch insert via the
  // tagged template, so insert one at a time; on conflict do nothing makes
  // re-running this cheap once the grid already exists.
  for (const r of rows) {
    await sql`
      insert into court_slots (court_id, venue_id, organization_id, date, start_time, end_time, price, status)
      values (${r.courtId}, ${r.venueId}, ${r.organizationId}, ${r.date}, ${r.startTime}, ${r.endTime}, ${r.price}, 'open')
      on conflict (court_id, date, start_time) do nothing
    `;
  }
}

export async function listSlots(sql, venueId, { date, courtId } = {}) {
  const queryDate = date || dateStr(new Date());

  const fetch = () =>
    courtId
      ? sql`
          select s.*, c.name as court_name, c.sport_id
          from court_slots s join courts c on s.court_id = c.id
          where s.venue_id = ${venueId} and s.date = ${queryDate} and s.court_id = ${courtId}
          order by s.start_time asc`
      : sql`
          select s.*, c.name as court_name, c.sport_id
          from court_slots s join courts c on s.court_id = c.id
          where s.venue_id = ${venueId} and s.date = ${queryDate}
          order by s.start_time asc`;

  let slots = await fetch();
  if (slots.length === 0) {
    await generateSlotsForNextDays(sql, venueId, 14);
    slots = await fetch();
  }
  return slots;
}

export async function getSlotOrThrow(sql, slotId) {
  const [slot] = await sql`select * from court_slots where id = ${slotId}`;
  if (!slot) throw httpError(404, "Slot not found");
  return slot;
}
