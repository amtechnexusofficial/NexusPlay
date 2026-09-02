import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDb } from "./db.js";
import {
  listSlotsForTurf,
  createSlot,
  joinSlot,
  bookFullSlot,
  acceptFullBookingRequest,
  declineFullBookingRequest,
  cancelSlotManually,
  checkPoolTimeouts,
  listActivity,
  httpError,
} from "./services/pooling.js";
import { requestOtp, verifyOtp, requireAuth } from "./auth.js";
import { uploadLogo, serveUpload } from "./uploads.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin, c) => c.env.ALLOWED_ORIGIN || "*",
  })
);

app.onError((err, c) => {
  console.error(err);
  const status = err.status || 500;
  return c.json({ error: err.message || "Internal error" }, status);
});

app.get("/api/health", (c) => c.json({ ok: true }));

// --- Auth ---------------------------------------------------------------
// OTP sending is stubbed (logs to console / returns devCode in dev) —
// see src/auth.js sendOtpSms() to wire up a real SMS provider.

app.post("/api/auth/request-otp", async (c) => {
  const sql = getDb(c.env);
  const body = await c.req.json();
  const result = await requestOtp(sql, c.env, body);
  return c.json(result);
});

app.post("/api/auth/verify-otp", async (c) => {
  const sql = getDb(c.env);
  const body = await c.req.json();
  const result = await verifyOtp(sql, c.env, body);
  return c.json(result);
});

// --- Turfs -----------------------------------------------------------

// Public: used by players to browse a specific turf's branded page.
app.get("/api/turfs/:turfId", async (c) => {
  const sql = getDb(c.env);
  const [turf] = await sql`select id, name, location, website_url, logo_url, brand_color from turfs where id = ${c.req.param("turfId")}`;
  if (!turf) throw httpError(404, "Turf not found");
  return c.json(turf);
});

app.get("/api/turfs", async (c) => {
  const sql = getDb(c.env);
  const turfs = await sql`select id, name, location, website_url, logo_url, brand_color from turfs order by created_at`;
  return c.json(turfs);
});

// Owner-only: turfs this signed-in owner has onboarded.
app.get("/api/turfs/mine", requireAuth("owner"), async (c) => {
  const sql = getDb(c.env);
  const user = c.get("user");
  const turfs = await sql`select * from turfs where owner_user_id = ${user.sub} order by created_at`;
  return c.json(turfs);
});

// Owner onboarding: business name, location, website, logo.
// Logo is uploaded separately first via POST /api/uploads/logo, then its
// returned URL is passed here as logoUrl.
app.post("/api/turfs", requireAuth("owner"), async (c) => {
  const sql = getDb(c.env);
  const user = c.get("user");
  const body = await c.req.json();
  if (!body.name || !body.location) throw httpError(400, "name and location are required");

  const [turf] = await sql`
    insert into turfs (owner_user_id, name, location, owner_name, website_url, logo_url, brand_color)
    values (${user.sub}, ${body.name}, ${body.location}, ${user.name}, ${body.websiteUrl || null}, ${body.logoUrl || null}, ${body.brandColor || "#4C9A5B"})
    returning *
  `;
  return c.json(turf, 201);
});

app.patch("/api/turfs/:turfId", requireAuth("owner"), async (c) => {
  const sql = getDb(c.env);
  const user = c.get("user");
  const turfId = c.req.param("turfId");
  const [existing] = await sql`select * from turfs where id = ${turfId}`;
  if (!existing) throw httpError(404, "Turf not found");
  if (existing.owner_user_id !== user.sub) throw httpError(403, "Not your turf");

  const body = await c.req.json();
  const [updated] = await sql`
    update turfs set
      name = ${body.name ?? existing.name},
      location = ${body.location ?? existing.location},
      website_url = ${body.websiteUrl ?? existing.website_url},
      logo_url = ${body.logoUrl ?? existing.logo_url},
      brand_color = ${body.brandColor ?? existing.brand_color}
    where id = ${turfId}
    returning *
  `;
  return c.json(updated);
});

// --- Logo upload (R2) ----------------------------------------------------

app.post("/api/uploads/logo", requireAuth("owner"), async (c) => {
  const result = await uploadLogo(c);
  return c.json(result, 201);
});

app.get("/api/uploads/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/uploads\//, "");
  return serveUpload(c, key);
});

// --- Slots -------------------------------------------------------------

app.get("/api/turfs/:turfId/slots", async (c) => {
  const sql = getDb(c.env);
  const slots = await listSlotsForTurf(sql, c.req.param("turfId"));
  return c.json(slots);
});

app.post("/api/turfs/:turfId/slots", requireAuth("owner"), async (c) => {
  const sql = getDb(c.env);
  const user = c.get("user");
  const turfId = c.req.param("turfId");
  const [turf] = await sql`select * from turfs where id = ${turfId}`;
  if (!turf) throw httpError(404, "Turf not found");
  if (turf.owner_user_id !== user.sub) throw httpError(403, "Not your turf");

  const body = await c.req.json();
  for (const field of ["date", "startTime", "endTime", "fullPrice"]) {
    if (!body[field]) throw httpError(400, `${field} is required`);
  }
  const slot = await createSlot(sql, turfId, body);
  return c.json(slot, 201);
});

// --- Player actions ------------------------------------------------------
// Player identity comes from their auth token, not free-text fields —
// keeps "My Bookings" and refunds tied to a real account.

app.post("/api/slots/:slotId/join", requireAuth("player"), async (c) => {
  const sql = getDb(c.env);
  const user = c.get("user");
  const slot = await joinSlot(sql, c.req.param("slotId"), { name: user.name, phone: user.phone });
  return c.json(slot);
});

app.post("/api/slots/:slotId/book-full", requireAuth("player"), async (c) => {
  const sql = getDb(c.env);
  const user = c.get("user");
  const result = await bookFullSlot(sql, c.req.param("slotId"), { name: user.name, phone: user.phone });
  return c.json(result);
});

// --- Owner actions -------------------------------------------------------

app.post("/api/slots/:slotId/owner/accept-full", requireAuth("owner"), async (c) => {
  const sql = getDb(c.env);
  const slot = await acceptFullBookingRequest(sql, c.req.param("slotId"));
  return c.json(slot);
});

app.post("/api/slots/:slotId/owner/decline-full", requireAuth("owner"), async (c) => {
  const sql = getDb(c.env);
  const slot = await declineFullBookingRequest(sql, c.req.param("slotId"));
  return c.json(slot);
});

app.post("/api/slots/:slotId/owner/cancel", requireAuth("owner"), async (c) => {
  const sql = getDb(c.env);
  const slot = await cancelSlotManually(sql, c.req.param("slotId"));
  return c.json(slot);
});

app.get("/api/owner/activity", requireAuth("owner"), async (c) => {
  const sql = getDb(c.env);
  const rows = await listActivity(sql);
  return c.json(rows);
});

export default {
  fetch: app.fetch,

  // Cloudflare Cron Trigger — see wrangler.toml [triggers]. Runs every minute.
  async scheduled(event, env, ctx) {
    const sql = getDb(env);
    const cancelled = await checkPoolTimeouts(sql);
    if (cancelled > 0) console.log(`Timed out ${cancelled} pool(s).`);
  },
};
