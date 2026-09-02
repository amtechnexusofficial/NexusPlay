import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDb } from "./db.js";
import { httpError } from "./errors.js";
import { requestOtp, verifyOtp, adminLogin, requireAuth, requireOrg } from "./auth.js";
import { uploadImage, serveUpload } from "./uploads.js";
import { listSports } from "./services/sports.js";
import {
  listVenuesForOrg,
  getVenueForOrg,
  getPublicVenue,
  listPublicVenues,
  createVenue,
  updateVenue,
  deleteVenue,
} from "./services/venues.js";
import {
  listCourtsForVenue,
  listPublicCourtsForVenue,
  createCourt,
  updateCourt,
  deleteCourt,
} from "./services/courts.js";

const app = new Hono();

app.use("*", async (c, next) => {
  // ALLOWED_ORIGIN can be a single origin or a comma-separated list.
  // Falls back to "*" only when explicitly unset (fine for local dev;
  // set it once you have a real frontend domain).
  const allowed = (c.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return cors({ origin: allowed.length > 0 ? allowed : "*" })(c, next);
});

app.onError((err, c) => {
  console.error(err);
  const status = err.status || 500;
  return c.json({ error: err.message || "Internal error" }, status);
});

app.get("/api/health", (c) => c.json({ ok: true }));

// ===========================================================================
// Auth
// ===========================================================================
// OTP sending is stubbed (logs to console / returns devCode in dev) — see
// src/auth.js's sendOtpSms() to wire up a real SMS provider before launch.

app.post("/api/auth/request-otp", async (c) => {
  const sql = getDb(c.env);
  const result = await requestOtp(sql, c.env, await c.req.json());
  return c.json(result);
});

app.post("/api/auth/verify-otp", async (c) => {
  const sql = getDb(c.env);
  const result = await verifyOtp(sql, c.env, await c.req.json());
  return c.json(result);
});

// Admin accounts are provisioned manually, not via public sign-up.
app.post("/api/auth/admin-login", async (c) => {
  const sql = getDb(c.env);
  const result = await adminLogin(sql, c.env, await c.req.json());
  return c.json(result);
});

// ===========================================================================
// Sports catalog (global, read-only for now)
// ===========================================================================

app.get("/api/sports", async (c) => {
  const sql = getDb(c.env);
  return c.json(await listSports(sql));
});

// ===========================================================================
// Public: marketplace / shareable venue page
// (nexusplay.com/venue/:slug — no auth required)
// ===========================================================================

app.get("/api/public/venues", async (c) => {
  const sql = getDb(c.env);
  const sportId = c.req.query("sportId") || undefined;
  const search = c.req.query("search") || undefined;
  return c.json(await listPublicVenues(sql, { sportId, search }));
});

app.get("/api/public/venues/:slug", async (c) => {
  const sql = getDb(c.env);
  const venue = await getPublicVenue(sql, c.req.param("slug"));
  const courts = await listPublicCourtsForVenue(sql, venue.id);
  return c.json({ ...venue, courts });
});

// ===========================================================================
// Owner: venues (requires an owner/manager/staff token with an org)
// ===========================================================================

const ownerAuth = [requireAuth(["owner", "admin"]), requireOrg()];

app.get("/api/venues", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await listVenuesForOrg(sql, c.get("organizationId")));
});

app.get("/api/venues/:venueId", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await getVenueForOrg(sql, c.get("organizationId"), c.req.param("venueId")));
});

app.post("/api/venues", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const venue = await createVenue(sql, c.get("organizationId"), await c.req.json());
  return c.json(venue, 201);
});

app.patch("/api/venues/:venueId", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const venue = await updateVenue(sql, c.get("organizationId"), c.req.param("venueId"), await c.req.json());
  return c.json(venue);
});

app.delete("/api/venues/:venueId", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await deleteVenue(sql, c.get("organizationId"), c.req.param("venueId")));
});

// ===========================================================================
// Owner: courts (nested under a venue)
// ===========================================================================

app.get("/api/venues/:venueId/courts", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await listCourtsForVenue(sql, c.get("organizationId"), c.req.param("venueId")));
});

app.post("/api/venues/:venueId/courts", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const court = await createCourt(sql, c.get("organizationId"), c.req.param("venueId"), await c.req.json());
  return c.json(court, 201);
});

app.patch("/api/courts/:courtId", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const court = await updateCourt(sql, c.get("organizationId"), c.req.param("courtId"), await c.req.json());
  return c.json(court);
});

app.delete("/api/courts/:courtId", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await deleteCourt(sql, c.get("organizationId"), c.req.param("courtId")));
});

// ===========================================================================
// Uploads (venue/court photos, owner branding)
// ===========================================================================

app.post("/api/uploads", requireAuth(["owner", "admin"]), async (c) => {
  const result = await uploadImage(c);
  return c.json(result, 201);
});

app.get("/api/uploads/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/uploads\//, "");
  return serveUpload(c, key);
});

export default {
  fetch: app.fetch,

  // Cloudflare Cron Trigger — see wrangler.toml [triggers]. Currently a
  // no-op placeholder; Phase 3 (booking flow) will add the expired-hold
  // sweep here, reusing this same trigger.
  async scheduled(event, env, ctx) {
    // TODO(phase 3): sweep expired booking holds back to open slots.
  },
};
