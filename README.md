# NexusPlay

Multi-tenant sports venue management & booking platform. See
`ARCHITECTURE.md` for the full technical plan, database schema, and build
order — this README covers setup for what's implemented so far.

## Status: Phase 1 of 7 — Foundation

Implemented and smoke-tested:

- Multi-tenant DB schema (`organizations → venues → courts`, plus the full
  entity set: `court_slots`, `bookings`, `payments`, `customers`, `games`,
  etc. — tables for later phases already exist so migrations won't churn)
- Auth: phone+OTP for players/owners (owner sign-up auto-provisions an
  `organization`), email+password for admins (provisioned manually, no
  public sign-up)
- RBAC middleware (`requireAuth`, `requireOrg`) — every owner-facing query
  is scoped by `organization_id`
- Venue CRUD (owner) + public venue listing/detail (for the future
  shareable booking page)
- Court CRUD (owner), scoped to the parent venue
- Sports catalog (seeded, read-only)
- Image upload to R2 (venue/court photos, branding)

Not yet implemented (see `ARCHITECTURE.md` §6 for order): slot generation,
booking hold/payment/confirm flow, owner dashboard & calendar, customer
CRM, notifications, marketplace search, split payments, Open Games. The
frontend (`frontend/`) has not been updated for the new API shape yet —
that comes with the booking-flow phase so there's a working end-to-end
flow to build UI against, rather than screens with nothing behind them.

## Stack

- **Frontend** — React + Vite → Cloudflare Pages
- **Backend** — Hono on Cloudflare Workers
- **Database** — Neon (serverless Postgres)
- **Storage** — Cloudflare R2 (venue/court photos, branding)
- **Scheduling** — Cloudflare Cron Trigger (currently a no-op placeholder;
  wired up in the booking-flow phase to sweep expired holds)

```
nexusplay/
├── ARCHITECTURE.md      Full technical plan, schema, build order
├── backend/
│   ├── schema.sql         Run against Neon once
│   ├── wrangler.toml
│   └── src/
│       ├── index.js       Routes
│       ├── db.js          Neon client + withTransaction() for locked writes
│       ├── auth.js         OTP (player/owner) + password (admin) + RBAC middleware
│       ├── errors.js       httpError() helper
│       ├── uploads.js      R2 image upload/serve
│       └── services/
│           ├── venues.js
│           ├── courts.js
│           └── sports.js
└── frontend/             Not yet updated for the new API (see above)
```

## 1. Set up Neon

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (`postgres://...?sslmode=require`).
3. Run the schema:
   ```bash
   psql "$DATABASE_URL" -f backend/schema.sql
   ```

## 2. Set up R2

```bash
cd backend
npx wrangler r2 bucket create nexusplay-media
```
Matches the `[[r2_buckets]]` binding in `wrangler.toml`.

## 3. Backend — Cloudflare Workers

```bash
cd backend
npm install
npx wrangler login
cp .dev.vars.example .dev.vars   # fill in DATABASE_URL, JWT_SECRET; set DEV_MODE=true for local testing
npm run dev                       # http://localhost:8787
```

Deploy:
```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
npm run deploy
```

**About OTP / SMS**: stubbed — `src/auth.js`'s `sendOtpSms()` logs the
code to the console, and with `DEV_MODE=true` the API response includes
the code directly. Wire up a real provider (MSG91, Twilio Verify, etc.)
before going live, and make sure `DEV_MODE` is unset/`false` in the
deployed `wrangler.toml` — leaving it on is a full auth bypass.

**Provisioning an admin account**: there's no public admin sign-up. Hash
a password and insert the row directly, e.g. via a one-off script that
imports `hashPassword` from `src/auth.js`, or `wrangler dev` REPL.

## 4. Frontend

Not yet updated for the new multi-tenant API — hold off on `npm run dev`
here until the booking-flow phase lands; the old turf/slot screens still
call endpoints that no longer exist.

## API reference (Phase 1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/request-otp` | — | Send OTP (player/owner) |
| POST | `/api/auth/verify-otp` | — | Verify OTP, sign up if new, return JWT |
| POST | `/api/auth/admin-login` | — | Admin email+password login |
| GET | `/api/sports` | — | List sports catalog |
| GET | `/api/public/venues` | — | List active venues (marketplace, `?sportId=` / `?search=`) |
| GET | `/api/public/venues/:slug` | — | Public venue detail + courts (shareable page) |
| GET | `/api/venues` | owner | List this org's venues |
| GET | `/api/venues/:venueId` | owner | Get one venue |
| POST | `/api/venues` | owner | Create venue |
| PATCH | `/api/venues/:venueId` | owner | Update venue |
| DELETE | `/api/venues/:venueId` | owner | Delete venue |
| GET | `/api/venues/:venueId/courts` | owner | List courts for a venue |
| POST | `/api/venues/:venueId/courts` | owner | Create court |
| PATCH | `/api/courts/:courtId` | owner | Update court |
| DELETE | `/api/courts/:courtId` | owner | Delete court |
| POST | `/api/uploads` | owner | Upload an image (field: `file`), returns its URL |
| GET | `/api/uploads/:key` | — | Serve an uploaded image |
