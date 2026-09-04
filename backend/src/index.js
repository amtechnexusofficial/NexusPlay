import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDb } from "./db.js";
import { httpError } from "./errors.js";
import { requestOtp, verifyOtp, adminLogin, registerOwner, loginOwnerPassword, requireAuth, requireOrg } from "./auth.js";
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
import { listSlots, blockSlot, unblockSlot, updateSlotPrice, listLiveSlots } from "./services/slots.js";
import { holdSlot, confirmBooking, releaseHold, sweepExpiredHolds } from "./services/bookings.js";
import { getSplitShare, paySplitShare } from "./services/splitPayments.js";
import {
  getContext,
  getAnalytics,
  listBookings,
  createWalkIn,
  updateBookingAction,
  listCustomers,
  listPendingUpi,
  verifyUpiPayment,
  updateVenueProfile,
  getVenueProfile,
  convertSlotToFullInquiry,
  declineSlotInquiry,
} from "./services/owner.js";
import { listGames, createGame, joinGame, requestFullSlot } from "./services/games.js";
import { getPlayerDashboard, listPlayerNotifications } from "./services/players.js";
import { createReview, listReviewsForVenue } from "./services/reviews.js";
import { getPlatformStats, listAllVenuesForAdmin, setVenueStatusForAdmin } from "./services/admin.js";

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

// Owner: email + password (second front door alongside phone + OTP above).
app.post("/api/auth/owner/register", async (c) => {
  const sql = getDb(c.env);
  const result = await registerOwner(sql, c.env, await c.req.json());
  return c.json(result, 201);
});

app.post("/api/auth/owner/login", async (c) => {
  const sql = getDb(c.env);
  const result = await loginOwnerPassword(sql, c.env, await c.req.json());
  return c.json(result);
});

app.get("/api/auth/me", requireAuth(), async (c) => {
  return c.json({ user: c.get("user") });
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

app.get("/api/public/venues/:slug/reviews", async (c) => {
  const sql = getDb(c.env);
  const venue = await getPublicVenue(sql, c.req.param("slug"));
  return c.json(await listReviewsForVenue(sql, venue.id));
});

app.post("/api/reviews", async (c) => {
  const sql = getDb(c.env);
  const review = await createReview(sql, await c.req.json());
  return c.json({ success: true, review }, 201);
});

app.get("/api/public/venues/:slug/slots", async (c) => {
  const sql = getDb(c.env);
  const venue = await getPublicVenue(sql, c.req.param("slug"));
  const date = c.req.query("date") || undefined;
  const courtId = c.req.query("courtId") || undefined;
  return c.json(await listSlots(sql, venue.id, { date, courtId }));
});

// ===========================================================================
// Player: own dashboard (bookings/games across every venue they've used —
// see services/players.js for why this joins through customers.phone
// rather than a single organization-scoped customer id)
// ===========================================================================

app.get("/api/player/dashboard", async (c) => {
  const sql = getDb(c.env);
  return c.json(await getPlayerDashboard(sql, c.req.query("phone")));
});

app.get("/api/player/notifications", async (c) => {
  const sql = getDb(c.env);
  return c.json(await listPlayerNotifications(sql, c.req.query("phone")));
});

// ===========================================================================
// Booking flow (public — no auth required to hold/confirm/release a slot)
// ===========================================================================

app.post("/api/bookings/hold-slot", async (c) => {
  const result = await holdSlot(c.env, await c.req.json());
  return c.json({ success: true, ...result });
});

app.post("/api/bookings/confirm", async (c) => {
  const result = await confirmBooking(c.env, await c.req.json());
  return c.json({ success: true, ...result });
});

app.post("/api/bookings/release-hold", async (c) => {
  const result = await releaseHold(c.env, await c.req.json());
  return c.json(result);
});

// Split payment: a shareable per-teammate reimbursement link generated
// when a booking is confirmed with splitCount > 1.
app.get("/api/split/:token", async (c) => {
  const sql = getDb(c.env);
  return c.json(await getSplitShare(sql, c.req.param("token")));
});

app.post("/api/split/:token/pay", async (c) => {
  const sql = getDb(c.env);
  const result = await paySplitShare(sql, c.req.param("token"), await c.req.json());
  return c.json({ success: true, ...result });
});

// ===========================================================================
// Open Games (public — no auth, mirrors the booking flow's trust model:
// organizer/player identity comes from the name+phone they submit, same
// as a customer checking out)
// ===========================================================================

app.get("/api/games", async (c) => {
  const sql = getDb(c.env);
  const sportId = c.req.query("sport") || undefined;
  const venueId = c.req.query("venueId") || undefined;
  const date = c.req.query("date") || undefined;
  return c.json(await listGames(sql, { sportId, venueId, date }));
});

app.post("/api/games/create", async (c) => {
  const result = await createGame(c.env, await c.req.json());
  return c.json({ success: true, ...result });
});

app.post("/api/games/:gameId/join", async (c) => {
  const result = await joinGame(c.env, c.req.param("gameId"), await c.req.json());
  return c.json({ success: true, ...result });
});

app.post("/api/games/:gameId/request-full-slot", async (c) => {
  const sql = getDb(c.env);
  const result = await requestFullSlot(sql, c.req.param("gameId"), await c.req.json());
  return c.json({ success: true, ...result });
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
// Owner dashboard: daily operations (bookings, walk-ins, slot management,
// CRM, UPI verification, business profile). Everything here is scoped to
// the caller's organizationId via ownerAuth — an owner can only ever see
// or touch their own tenant's data.
// ===========================================================================

app.get("/api/owner/context", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await getContext(sql, c.get("organizationId"), c.get("user")));
});

app.get("/api/owner/analytics", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await getAnalytics(sql, c.get("organizationId"), c.req.query("venueId") || undefined));
});

app.get("/api/owner/bookings", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const venueId = c.req.query("venueId") || undefined;
  const date = c.req.query("date") || undefined;
  return c.json(await listBookings(sql, c.get("organizationId"), { venueId, date }));
});

app.post("/api/owner/walk-in", ...ownerAuth, async (c) => {
  const result = await createWalkIn(c.env, c.get("organizationId"), await c.req.json());
  return c.json({ success: true, ...result });
});

app.patch("/api/owner/bookings/:bookingId", ...ownerAuth, async (c) => {
  const result = await updateBookingAction(c.env, c.get("organizationId"), c.req.param("bookingId"), await c.req.json());
  return c.json({ success: true, ...result });
});

app.post("/api/owner/slots/block", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const slot = await blockSlot(sql, c.get("organizationId"), await c.req.json());
  return c.json({ success: true, slot });
});

app.post("/api/owner/slots/unblock", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const slot = await unblockSlot(sql, c.get("organizationId"), await c.req.json());
  return c.json({ success: true, slot });
});

app.patch("/api/owner/slots/:slotId/price", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const { price } = await c.req.json();
  const slot = await updateSlotPrice(sql, c.get("organizationId"), c.req.param("slotId"), Number(price));
  return c.json({ success: true, slot });
});

app.post("/api/owner/slots/:slotId/convert-full-inquiry", ...ownerAuth, async (c) => {
  const result = await convertSlotToFullInquiry(c.env, c.get("organizationId"), c.req.param("slotId"), await c.req.json());
  return c.json({ success: true, ...result });
});

app.post("/api/owner/slots/:slotId/decline-full-inquiry", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const result = await declineSlotInquiry(sql, c.get("organizationId"), c.req.param("slotId"));
  return c.json({ success: true, ...result });
});

app.get("/api/owner/live-slots", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const venueId = c.req.query("venueId");
  if (!venueId) throw httpError(400, "venueId is required");
  return c.json(await listLiveSlots(sql, c.get("organizationId"), venueId, c.req.query("date") || undefined));
});

app.get("/api/owner/crm", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await listCustomers(sql, c.get("organizationId")));
});

app.post("/api/owner/courts", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const body = await c.req.json();
  const court = await createCourt(sql, c.get("organizationId"), body.venueId, body);
  return c.json({ success: true, courtId: court.id, court }, 201);
});

app.get("/api/owner/venues/:id", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await getVenueProfile(sql, c.get("organizationId"), c.req.param("id")));
});

app.put("/api/owner/venues/:id", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  const venue = await updateVenueProfile(sql, c.get("organizationId"), c.req.param("id"), await c.req.json());
  return c.json({ success: true, venue });
});

app.get("/api/owner/upi-pending", ...ownerAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await listPendingUpi(sql, c.get("organizationId"), c.req.query("venueId") || undefined));
});

app.post("/api/owner/bookings/:bookingId/verify-upi", ...ownerAuth, async (c) => {
  const result = await verifyUpiPayment(c.env, c.get("organizationId"), c.req.param("bookingId"), await c.req.json());
  return c.json({ success: true, ...result });
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
// Admin (amtechnexus platform operators only — role 'admin', provisioned
// manually via backend/scripts/create-admin.mjs, no public sign-up).
// Cross-tenant by design: no requireOrg() here, unlike every owner route.
// ===========================================================================

const adminAuth = requireAuth("admin");

app.get("/api/admin/stats", adminAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await getPlatformStats(sql));
});

app.get("/api/admin/venues", adminAuth, async (c) => {
  const sql = getDb(c.env);
  return c.json(await listAllVenuesForAdmin(sql));
});

app.patch("/api/admin/venues/:id/status", adminAuth, async (c) => {
  const sql = getDb(c.env);
  const { status } = await c.req.json();
  const venue = await setVenueStatusForAdmin(sql, c.req.param("id"), status);
  return c.json({ success: true, venue });
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

  // Cloudflare Cron Trigger — see wrangler.toml [triggers]. Runs every
  // minute; releases any slot whose 10-minute payment hold expired
  // without the customer completing checkout.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sweepExpiredHolds(env));
  },
};
