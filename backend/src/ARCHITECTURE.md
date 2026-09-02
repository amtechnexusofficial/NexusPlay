# NexusPlay — Technical Architecture & Implementation Plan

## 0. Where this starts from

The uploaded codebase ("Thidal") is a single-sport, single-court-per-turf
booking app with a working pooled-slot mechanic. It is being **replaced**,
not extended — the domain model (one turf = one bookable thing) can't
express venues with multiple courts, multiple sports, tiered pricing, or
org-level multi-tenancy. What's being **kept**:

- Stack: Cloudflare Workers (Hono) + Neon Postgres + R2 + Cloudflare Pages
- `db.js` connection pattern: `neon()` for simple reads, `withTransaction()`
  (node-postgres `Pool` over WebSocket, `SELECT ... FOR UPDATE`) for
  anything touching money or slot state
- OTP request/verify flow and JWT issuance shape in `auth.js`
- R2 upload pattern in `uploads.js`
- CORS/error-handling scaffolding in `index.js`

Everything else is new.

## 1. Multi-tenancy & RBAC model

Three roles: `admin` (NexusPlay staff), `owner` (venue operator), `player`
(customer). Ownership chain: `organizations → venues → courts`. An owner
user belongs to one `organization`; every venue/court/booking/customer
row carries `organization_id` (denormalized onto hot-path tables) so every
query can filter by tenant in one predicate instead of walking joins, and
so a missing `WHERE organization_id = ?` fails loudly in review rather
than silently leaking cross-tenant data.

`staff_members` lets an owner invite sub-accounts (front-desk staff) scoped
to specific venues with a narrower permission set (create walk-ins, mark
cash payments — not edit pricing or view payouts).

**Enforcement pattern**: a single `requireOrg` middleware resolves
`organization_id` from the JWT and attaches it to context; every service
function that touches tenant data takes `organizationId` as a mandatory
first argument and includes it in the `WHERE` clause of every query — no
service function trusts a bare `venueId`/`courtId` from the client without
also checking it resolves under the caller's org. This is checked with a
lightweight lint step (grep for queries missing `organization_id`) before
each merge, given how easy it is to regress.

## 2. Database schema (Postgres / Neon)

Design choices worth calling out:

- **Money in integer minor units** (paise/cents), not floats — avoids
  rounding bugs in split payments.
- **`court_slots` are materialized, not computed on the fly.** Courts
  define operating hours + slot duration; a generator job/cron writes
  concrete `court_slots` rows N days ahead (rolling window, e.g. 30 days).
  This is what actually gets locked/booked, and it's what makes "prevent
  double booking" a single `UNIQUE` constraint + row lock instead of
  overlap-interval math on every request.
- **Booking hold vs. confirmed booking are the same row, different
  status.** A `bookings` row is created in `status='pending_payment'` the
  moment a slot is selected, with `hold_expires_at`. This is what "locks"
  the slot: `court_slots.status` flips to `held`, and a partial unique
  index enforces at most one active (`pending_payment`/`confirmed`)
  booking per `court_slot_id`. A cron sweep (reusing the existing cron
  trigger pattern) releases expired holds every minute.
- **Payments are a separate table from bookings** (1 booking → many
  payment attempts) so retries/partial payments/refunds don't mutate
  booking history, and so the provider abstraction only touches one table.

```sql
-- Tenancy & identity
organizations(id, name, billing_email, created_at)
users(id, email, phone, password_hash, name, role, created_at)
  -- role: admin | owner | player  (owner users also get an organization_members row)
organization_members(id, organization_id, user_id, role, created_at)
  -- role here: owner | manager | staff  — org-level permission, distinct from users.role
staff_members(id, organization_id, user_id, venue_id, permissions jsonb, created_at)

-- Catalog
sports(id, name, icon, slug)                          -- global reference table, seeded
venues(id, organization_id, name, slug, description, address, lat, lng,
       phone, email, photos jsonb, amenities jsonb, sport_ids uuid[],
       open_time, close_time, status, created_at)
courts(id, organization_id, venue_id, name, sport_id, capacity,
       slot_duration_minutes, base_price, peak_price, weekend_price,
       peak_hours jsonb,          -- [{from:'18:00',to:'22:00'}]
       open_time, close_time, status, created_at)

-- Availability
court_slots(id, organization_id, court_id, date, start_time, end_time,
            price, status,        -- open | held | booked | blocked | maintenance
            hold_expires_at, created_at)
  unique(court_id, date, start_time)
blackout_dates(id, organization_id, venue_id, court_id, date, reason)
holidays(id, organization_id, venue_id, date, label)

-- Bookings
customers(id, organization_id, name, phone, email,
          total_spend, total_bookings, last_booking_at, created_at)
  unique(organization_id, phone)
bookings(id, organization_id, venue_id, court_id, court_slot_id,
         customer_id, created_by_user_id, source,   -- online | walk_in | marketplace | game
         status,     -- pending_payment | confirmed | cancelled | completed | no_show
         payment_status,  -- pending | paid | failed | cash | partially_paid | refunded | cancelled
         total_amount, amount_paid, hold_expires_at,
         notes, created_at, updated_at)
booking_participants(id, booking_id, name, phone, share_amount,
                      payment_status, payment_link_token, created_at)
  -- powers split-payment: one row per player owing a share

payments(id, organization_id, booking_id, provider,   -- razorpay | stripe | cash
          provider_payment_id, provider_order_id, amount, currency,
          status, method, raw_payload jsonb, created_at)
refunds(id, organization_id, payment_id, amount, status, reason,
        provider_refund_id, created_at)

-- Reviews
reviews(id, organization_id, venue_id, customer_id, booking_id,
        rating, comment, created_at)

-- Notifications (architecture only for MVP — see §5)
notifications(id, organization_id, user_id, customer_id, type, channel,
              status, payload jsonb, scheduled_for, sent_at, created_at)

-- Phase 2: Open Games / marketplace
games(id, organization_id, venue_id, court_id, court_slot_id,
      organizer_customer_id, sport_id, title, starts_at,
      capacity, price_per_player, status,   -- open | full | confirmed | cancelled
      created_at)
game_participants(id, game_id, customer_id, payment_status, share_amount,
                   joined_at)
  unique(game_id, customer_id)
```

Indexes: `court_slots(court_id, date, status)`,
`bookings(organization_id, court_slot_id) where status in ('pending_payment','confirmed')`
(partial unique — the double-booking guard), `customers(organization_id, phone)`,
`games(status, starts_at)`.

## 3. Booking-hold concurrency (prevents double booking & payment races)

Reuses the existing `withTransaction()` pattern:

1. `POST /bookings/hold` — inside a transaction: `SELECT court_slots ... FOR UPDATE`,
   verify `status = 'open'`, insert `bookings` row (`pending_payment`,
   `hold_expires_at = now() + hold_minutes`), update `court_slots.status = 'held'`.
   The partial unique index on `bookings` is the second line of defense if
   two holds somehow race past the row lock.
2. Payment provider webhook (or client confirm callback, provider-verified
   server-side) calls `POST /bookings/:id/confirm` — transaction locks the
   `bookings` row, checks `hold_expires_at > now()`, flips
   `status='confirmed'`, `court_slots.status='booked'`, upserts `customers`
   stats.
3. Cron (existing minute trigger) sweeps expired holds: `status='pending_payment' AND hold_expires_at < now()` → `cancelled`, slot back to `open`.
4. Manual cancel/reschedule/refund all go through the same lock-then-mutate
   transaction helper, never a bare `UPDATE`.

## 4. Payment provider abstraction

```
services/payments/
  index.js         -- getProvider(env, providerName) factory
  razorpay.js       -- createOrder(), verifyWebhookSignature(), refund()
  stripe.js         -- same interface, added when needed
```

Every provider implements `{ createOrder(amount, currency, meta), verifySignature(payload, headers), refund(paymentId, amount) }`.
Routes/services call only the interface, never a provider SDK directly.
Money goes to the venue owner's connected account
(Razorpay Route / Stripe Connect) — NexusPlay's own account never holds
booking funds, per your requirement; `payments.provider_payment_id` +
`raw_payload` are enough to reconcile without custody.

## 5. Notifications architecture (MVP: structural, not wired to a real sender)

`notifications` table + a `services/notifications.js` with
`notify(type, recipient, payload)` that writes a row and calls a
`channel` adapter (`console` in dev, swap for WhatsApp/SMS/email provider
later — same stubbing pattern as `sendOtpSms()` in the existing code, so
it's an intentional, documented seam, not a gap).

## 6. Build order (what "one by one" means in practice)

1. **Foundation** — schema, RBAC middleware, org/venue/court CRUD, sports catalog seed *(starting now)*
2. **Availability & public venue page** — slot generation job, `GET /venue/:slug` public endpoint
3. **Booking flow** — hold → payment → confirm, cron sweep, cancel/reschedule/refund
4. **Owner dashboard** — calendar views, walk-in/cash booking, analytics queries
5. **Customer CRM** — auto-maintained from booking events
6. **Notifications scaffolding**
7. **Phase 2** — marketplace discovery/search, split payments, Open Games

I'll build these in order, show you each working piece, and only move to
the next once you've confirmed it. Starting with **Step 1: Foundation**
now.
