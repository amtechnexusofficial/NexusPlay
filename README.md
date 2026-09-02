# Thidal (clone)

A turf booking platform: owners list slots, players either book a slot
outright or join a **pooled slot** — a slot only confirms once enough
players (owner-configurable, e.g. 8) join within a time window (default
60 minutes). If the pool doesn't fill in time, everyone is auto-refunded
and the slot reopens. If someone offers to book the *whole* slot while a
pool is still filling, the owner is asked to approve — accepting refunds
the pooled players automatically.

## Stack

- **Frontend** — React + Vite → deployed to **Cloudflare Pages**
- **Backend** — Hono running on **Cloudflare Workers** (serverless, no server to manage)
- **Database** — **Neon** (serverless Postgres)
- **Scheduling** — Cloudflare **Cron Trigger** (runs every minute) checks pools that missed their deadline
- **CI/CD** — GitHub Actions deploys both on every push to `main`

```
thidal-clone/
├── backend/            Cloudflare Worker (Hono API)
│   ├── schema.sql       Run this against Neon once
│   ├── wrangler.toml
│   └── src/
│       ├── index.js     Routes + cron handler
│       ├── db.js        Neon client
│       └── services/pooling.js   All booking/pooling business logic
├── frontend/            Vite + React app
│   └── src/
│       ├── pages/PlayerView.jsx   Browse & book/join slots
│       ├── pages/OwnerView.jsx    Approve requests, manage slots
│       └── components/
└── .github/workflows/deploy.yml
```

## 1. Set up Neon

1. Create a project at [neon.tech](https://neon.tech) (free tier is enough to start).
2. Copy the connection string (starts with `postgres://...?sslmode=require`).
3. Run the schema against it:
   ```bash
   psql "$DATABASE_URL" -f backend/schema.sql
   ```
   This creates the tables (including `users`, `otp_codes`, and branding columns on
   `turfs`) and seeds one demo turf with today's slots.

## 2. Set up R2 (for owner logo uploads)

```bash
cd backend
npx wrangler r2 bucket create thidal-logos
```
This matches the `[[r2_buckets]]` binding already in `wrangler.toml`.

## 3. Backend — Cloudflare Workers

```bash
cd backend
npm install
npx wrangler login

# Local dev: copy .dev.vars.example -> .dev.vars and fill in DATABASE_URL + JWT_SECRET
cp .dev.vars.example .dev.vars

npm run dev          # runs at http://localhost:8787
```

Deploy:
```bash
npx wrangler secret put DATABASE_URL   # paste your Neon connection string
npx wrangler secret put JWT_SECRET     # any long random string
npm run deploy
```
Note the deployed Worker URL (e.g. `https://thidal-backend.<you>.workers.dev`) —
the frontend needs it.

The cron trigger in `wrangler.toml` (`* * * * *`) runs `checkPoolTimeouts`
every minute automatically once deployed — no extra setup needed.

**About OTP / SMS:** phone verification is stubbed — `src/auth.js`'s
`sendOtpSms()` just logs the code to the console, and with `DEV_MODE=true`
(the default in `wrangler.toml`) the API response includes the code directly
so you can log in without a real SMS provider. Before going live: wire
`sendOtpSms()` up to MSG91, Twilio Verify, or similar, and set `DEV_MODE`
to `false` (or remove the var) in `wrangler.toml`.

## 4. Frontend — Cloudflare Pages

```bash
cd frontend
npm install
cp .env.example .env.local     # set VITE_API_URL to your Worker URL
npm run dev                    # local dev at http://localhost:5173
```

Deploy:
```bash
npm run build
npx wrangler pages deploy dist --project-name=thidal-frontend
```

## 5. GitHub Actions (auto-deploy on push)

1. Push this repo to GitHub.
2. In your repo settings → **Secrets and variables → Actions**, add:
   - `CLOUDFLARE_API_TOKEN` — a Cloudflare token with Workers + Pages edit permissions
   - `CLOUDFLARE_ACCOUNT_ID` — from your Cloudflare dashboard
   - `WORKER_URL` — your deployed Worker URL, used to build the frontend
3. Every push to `main` will deploy both the Worker and the Pages site.
   (`DATABASE_URL` is set once via `wrangler secret put`, not through CI —
   it doesn't need to be redeployed on every push.)

## Auth & onboarding

- **Sign-in**: phone number + OTP for both players and owners (`POST /api/auth/request-otp`, `POST /api/auth/verify-otp`). Returns a JWT the frontend stores and sends as `Authorization: Bearer <token>`.
- **Owner onboarding**: first-time owners land on a form (business name, location, website, logo) before seeing the dashboard. Logo uploads go to R2 via `POST /api/uploads/logo` and are served back from `GET /api/uploads/:key`.
- **Branding everywhere**: the `<Brand>` component (frontend/src/components/Brand.jsx) reads the turf's `logo_url`/`name`/`website_url`/`brand_color` and is used in both the player and owner headers — update it in one place to change how branding shows up across the whole app.

## What's real vs. simulated

This is a working, deployable spec of the product — the pooling/threshold/
timeout/override logic, auth, and onboarding are fully implemented against a
real database. Two things are intentionally stubbed and would need real
provider accounts to finish:

- **Payments** — `pricePerPlayer`/`fullPrice` are charged instantly with no
  real gateway. Wire in Razorpay (or similar) inside `bookFullSlot` /
  `joinSlot` in `backend/src/services/pooling.js`, and issue real refunds in
  `checkPoolTimeouts`, `acceptFullBookingRequest`, and `cancelSlotManually`.
- **SMS OTP** — currently stubbed to log to the console (see `sendOtpSms()`
  in `backend/src/auth.js`). Swap in MSG91/Twilio Verify before launch.

Everything else — turf/slot CRUD, owner onboarding with branding, phone+OTP
auth, joining, threshold auto-confirm, deadline auto-cancel via cron, and the
owner's accept/decline override — runs for real.

## API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/request-otp` | \u2014 | Send (stubbed) OTP to a phone number |
| POST | `/api/auth/verify-otp` | \u2014 | Verify OTP, create account if new, return JWT |
| GET | `/api/turfs` | \u2014 | List turfs (public, for players) |
| GET | `/api/turfs/:turfId` | \u2014 | Single turf's public branding |
| GET | `/api/turfs/mine` | owner | Turfs this owner has onboarded |
| POST | `/api/turfs` | owner | Onboard a new turf (name, location, website, logo) |
| PATCH | `/api/turfs/:turfId` | owner | Update branding/details |
| POST | `/api/uploads/logo` | owner | Upload a logo image to R2, returns its URL |
| GET | `/api/uploads/:key` | \u2014 | Serve an uploaded logo |
| GET | `/api/turfs/:turfId/slots` | \u2014 | List a turf's slots |
| POST | `/api/turfs/:turfId/slots` | owner | Create a slot |
| POST | `/api/slots/:slotId/join` | player | Join a pooled slot |
| POST | `/api/slots/:slotId/book-full` | player | Book/offer to book the whole slot |
| POST | `/api/slots/:slotId/owner/accept-full` | owner | Accept a mid-pool full-booking request |
| POST | `/api/slots/:slotId/owner/decline-full` | owner | Decline it |
| POST | `/api/slots/:slotId/owner/cancel` | owner | Manually reset a slot, refunding any pool |
| GET | `/api/owner/activity` | owner | Activity/audit log |
