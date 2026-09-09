// The backend is a separate Cloudflare Worker, not served from this same
// origin — set VITE_API_BASE_URL (Cloudflare Pages → Settings → Environment
// variables) to the Worker's URL, e.g. https://nexusplay.<subdomain>.workers.dev.
// Falls back to same-origin /api for local dev against `wrangler dev` with
// a proxy, but will 404 in production if the env var isn't set.
const API_BASE = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api`;

export function getApiBase() {
  return API_BASE;
}

// Owner-scoped routes require a bearer token (see backend's requireAuth) —
// this was previously missing from every owner.* call below, which meant
// they'd all 401 against a real deployed backend.
function authHeaders() {
  const token = localStorage.getItem('nexus_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Do not clear the session inside the fetch wrapper. Clearing + reloading
// here raced the caller's catch block and wiped the real 401 reason
// (JwtAlgorithmRequired) before the diagnostic UI could show it. Callers
// that decide the session is dead should clear explicitly (or the user
// signs in again, which overwrites the token).
async function ownerFetch(url, options = {}) {
  return fetch(url, { ...options, headers: { ...(options.headers || {}), ...authHeaders() } });
}

// Admin sessions are deliberately kept out of the player/owner token —
// a separate login, a separate stored credential.
function adminAuthHeaders() {
  const token = localStorage.getItem('nexus_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed (${res.status})`);
    return res.json();
  },

  // Catalog & Marketplace
  async getSports() {
    const res = await fetch(`${API_BASE}/sports`);
    if (!res.ok) throw new Error('Failed to fetch sports');
    return res.json();
  },

  async getMarketplaceVenues(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/public/venues?${q}`);
    if (!res.ok) {
      // Same fix as getPublicVenue: surface the actual server error
      // instead of a hardcoded generic message, so a real backend
      // failure (schema drift, a crash) doesn't look identical to "no
      // network" or get silently swallowed upstream.
      const body = await res.json().catch(() => ({}));
      // position/hint (when present) point at exactly which character of
      // the query is malformed — critical for a bare "syntax error at or
      // near ..." that isn't reproducible just by reading the query text.
      const extra = [
        body.position && `position ${body.position}`,
        body.hint && `hint: ${body.hint}`,
      ].filter(Boolean).join(', ');
      throw new Error((body.error || `Failed to fetch venues (HTTP ${res.status})`) + (extra ? ` [${extra}]` : ''));
    }
    return res.json();
  },

  // Public Venue Page & Slots
  async getPublicVenue(slugOrId) {
    const res = await fetch(`${API_BASE}/public/venues/${slugOrId}`);
    if (!res.ok) {
      // A real server error (schema drift, a crash) used to be swallowed
      // as the same generic "Venue not found" as a genuinely missing/
      // unpublished venue — indistinguishable to whoever's debugging it.
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Venue not found (HTTP ${res.status})`);
    }
    return res.json();
  },

  async getVenueSlots(venueId, date, courtId) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (courtId) params.append('courtId', courtId);
    const res = await fetch(`${API_BASE}/public/venues/${venueId}/slots?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch slots');
    return res.json();
  },

  // Concurrency-safe Booking with Slot Lock
  async holdSlot(data) {
    const res = await fetch(`${API_BASE}/bookings/hold-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to reserve slot');
    return body;
  },

  async confirmBooking(data) {
    const res = await fetch(`${API_BASE}/bookings/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Booking confirmation failed');
    return body;
  },

  async releaseHold(data) {
    const res = await fetch(`${API_BASE}/bookings/release-hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Split payment — a teammate's individual reimbursement share
  async getSplitShare(token) {
    const res = await fetch(`${API_BASE}/split/${token}`);
    if (!res.ok) throw new Error('Payment link not found');
    return res.json();
  },

  async paySplitShare(token, data) {
    const res = await fetch(`${API_BASE}/split/${token}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to submit payment');
    return body;
  },

  // Open Games
  async getGames(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/games?${q}`);
    if (!res.ok) throw new Error('Failed to fetch open games');
    return res.json();
  },

  async createGame(data) {
    const res = await fetch(`${API_BASE}/games/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create game');
    return body;
  },

  async joinGame(gameId, data) {
    const res = await fetch(`${API_BASE}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to join game');
    return body;
  },

  async requestFullSlot(gameId, data) {
    const res = await fetch(`${API_BASE}/games/${gameId}/request-full-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to submit full slot booking request');
    return body;
  },

  // Venue Owner SaaS
  async getOwnerContext() {
    const res = await ownerFetch(`${API_BASE}/owner/context`);
    if (res.status === 401) {
      // Read the response as raw text first — if the body isn't JSON at
      // all (a Cloudflare edge error page, an empty body, an HTML error
      // page instead of the Worker's own JSON), res.json() would throw
      // and we'd fall back to a vague generic message. Carrying the raw
      // text guarantees the "not signed in" screen always shows *something*
      // concrete instead of ever going blank.
      const raw = await res.text().catch(() => '');
      let detail = raw;
      try {
        const body = JSON.parse(raw);
        detail = body.error || raw;
      } catch {
        // raw wasn't JSON — keep it as-is (or note there was nothing at all)
      }
      const err = new Error(`Not signed in: ${detail || `HTTP 401 with empty body`}`);
      err.notSignedIn = true;
      err.detail = detail || `HTTP 401 with empty body`;
      throw err;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to get owner context (${res.status})`);
    }
    return res.json();
  },

  async getOwnerAnalytics(venueId) {
    const q = venueId ? `?venueId=${venueId}` : '';
    const res = await ownerFetch(`${API_BASE}/owner/analytics${q}`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  async getOwnerBookings(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await ownerFetch(`${API_BASE}/owner/bookings?${q}`);
    if (!res.ok) throw new Error('Failed to fetch bookings');
    return res.json();
  },

  async createWalkInBooking(data) {
    const res = await ownerFetch(`${API_BASE}/owner/walk-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create walk-in');
    return body;
  },

  async updateBookingAction(bookingId, data) {
    const res = await ownerFetch(`${API_BASE}/owner/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Action failed');
    return body;
  },

  async generateSlotsForDate(data) {
    const res = await ownerFetch(`${API_BASE}/owner/slots/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    // Read as text first — if the Worker doesn't have this route yet
    // (a deploy that hasn't been promoted), the response is a plain-text
    // "404 Not Found", not JSON, and res.json() would throw a confusing
    // "Unexpected token" error instead of naming the real problem.
    const raw = await res.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error(`Server returned a non-JSON response (HTTP ${res.status}): "${raw.slice(0, 80)}" — the backend may not have this endpoint deployed yet.`);
    }
    if (!res.ok) throw new Error(body.error || 'Failed to generate slots');
    return body;
  },

  async blockSlot(data) {
    const res = await ownerFetch(`${API_BASE}/owner/slots/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async unblockSlot(data) {
    const res = await ownerFetch(`${API_BASE}/owner/slots/unblock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getCustomers() {
    const res = await ownerFetch(`${API_BASE}/owner/crm`);
    if (!res.ok) throw new Error('Failed to load CRM data');
    return res.json();
  },

  async createCourt(data) {
    const res = await ownerFetch(`${API_BASE}/owner/courts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // A brand-new owner account has an organization but zero venues — this
  // is the one-time "create your first venue" call that unblocks
  // everything else (courts, slots, the public booking page).
  async createVenue(data) {
    const res = await ownerFetch(`${API_BASE}/venues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create venue');
    return body;
  },

  async getOwnerVenueDetails(venueId) {
    const res = await ownerFetch(`${API_BASE}/owner/venues/${venueId}`);
    if (!res.ok) throw new Error('Failed to fetch venue details');
    return res.json();
  },

  async updateVenueProfile(venueId, data) {
    const res = await ownerFetch(`${API_BASE}/owner/venues/${venueId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to update venue profile');
    return body;
  },

  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    // No Content-Type header here — the browser sets it (with the right
    // multipart boundary) automatically when the body is a FormData.
    const res = await ownerFetch(`${API_BASE}/uploads`, {
      method: 'POST',
      body: formData
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to upload image');
    return body;
  },

  async getOwnerLiveSlots(venueId, date) {
    const q = new URLSearchParams({ venueId, date: date || '' }).toString();
    const res = await ownerFetch(`${API_BASE}/owner/live-slots?${q}`);
    if (!res.ok) throw new Error('Failed to fetch live slots');
    return res.json();
  },

  async convertSlotToFullInquiry(slotId, data) {
    const res = await ownerFetch(`${API_BASE}/owner/slots/${slotId}/convert-full-inquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to convert slot to full inquiry');
    return body;
  },

  async declineSlotInquiry(slotId) {
    const res = await ownerFetch(`${API_BASE}/owner/slots/${slotId}/decline-full-inquiry`, {
      method: 'POST'
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to decline slot inquiry');
    return body;
  },

  async updateSlotPrice(slotId, price) {
    const res = await ownerFetch(`${API_BASE}/owner/slots/${slotId}/price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to update slot price');
    return body;
  },

  // Owner Direct UPI Verification & Credit Audit
  async getPendingUpiBookings(venueId) {
    const q = venueId ? `?venueId=${venueId}` : '';
    const res = await ownerFetch(`${API_BASE}/owner/upi-pending${q}`);
    if (!res.ok) throw new Error('Failed to fetch pending UPI payments');
    return res.json();
  },

  async verifyUpiPayment(bookingId, { action = 'verify_credit', notes = '' }) {
    const res = await ownerFetch(`${API_BASE}/owner/bookings/${bookingId}/verify-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to verify UPI payment');
    return body;
  },

  async getVenueUpiSettings(venueId) {
    const res = await ownerFetch(`${API_BASE}/owner/venues/${venueId}/upi-settings`);
    if (!res.ok) throw new Error('Failed to fetch UPI settings');
    return res.json();
  },

  async updateVenueUpiSettings(venueId, data) {
    const res = await ownerFetch(`${API_BASE}/owner/venues/${venueId}/upi-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to update UPI settings');
    return body;
  },

  // Reports & Billing (POS-style transaction log)
  async getOwnerBillingReport(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await ownerFetch(`${API_BASE}/owner/billing?${q}`);
    if (!res.ok) throw new Error('Failed to load billing report');
    return res.json();
  },

  async getConfigInfo() {
    const res = await fetch(`${API_BASE}/config/info`);
    if (!res.ok) return null;
    return res.json();
  },

  // Reviews
  async getVenueReviews(slugOrId) {
    const res = await fetch(`${API_BASE}/public/venues/${slugOrId}/reviews`);
    if (!res.ok) return [];
    return res.json();
  },

  async submitReview(data) {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to submit review');
    return body;
  },

  // Authentication & Sessions
  // Player + owner can both sign in with phone + OTP (one identity, one
  // role per phone number); owner also has a second front door via
  // email + password, matching the SaaS dashboard sign-in UI.
  async requestOtp({ phone, role }) {
    const res = await fetch(`${API_BASE}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, role })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to send verification code');
    return body;
  },

  async verifyOtp({ phone, code, role, name, organizationName }) {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, role, name, organizationName })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Verification failed');
    return body;
  },

  async loginOwner({ email, password }) {
    const res = await fetch(`${API_BASE}/auth/owner/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Owner login failed');
    return body;
  },

  async registerOwner({ name, email, password, organizationName }) {
    const res = await fetch(`${API_BASE}/auth/owner/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, organizationName })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Owner registration failed');
    return body;
  },

  async getAuthMe(token) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) return null;
    return res.json();
  },

  async getPlayerDashboard(phone, token) {
    const params = new URLSearchParams();
    if (phone) params.append('phone', phone);
    const res = await fetch(`${API_BASE}/player/dashboard?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Failed to load player dashboard');
    return res.json();
  },

  async getPlayerNotifications(phone) {
    const params = new URLSearchParams();
    if (phone) params.append('phone', phone);
    const res = await fetch(`${API_BASE}/player/notifications?${params.toString()}`);
    if (!res.ok) return [];
    return res.json();
  },

  // Admin (amtechnexus platform operators) — separate credential and
  // token from player/owner sessions, see auth.js's adminLogin().
  async adminLogin({ email, password }) {
    const res = await fetch(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Admin login failed');
    return body;
  },

  async getAdminStats() {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: adminAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load platform stats');
    return res.json();
  },

  async getAdminVenues() {
    const res = await fetch(`${API_BASE}/admin/venues`, { headers: adminAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load venues');
    return res.json();
  },

  async setAdminVenueStatus(venueId, status) {
    const res = await fetch(`${API_BASE}/admin/venues/${venueId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
      body: JSON.stringify({ status })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to update venue status');
    return body;
  }
};
