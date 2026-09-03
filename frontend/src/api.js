const API_BASE = '/api';

export const api = {
  // Catalog & Marketplace
  async getSports() {
    const res = await fetch(`${API_BASE}/sports`);
    if (!res.ok) throw new Error('Failed to fetch sports');
    return res.json();
  },

  async getMarketplaceVenues(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/marketplace/venues?${q}`);
    if (!res.ok) throw new Error('Failed to fetch venues');
    return res.json();
  },

  // Public Venue Page & Slots
  async getPublicVenue(slugOrId) {
    const res = await fetch(`${API_BASE}/public/venue/${slugOrId}`);
    if (!res.ok) throw new Error('Venue not found');
    return res.json();
  },

  async getVenueSlots(venueId, date, courtId) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (courtId) params.append('courtId', courtId);
    const res = await fetch(`${API_BASE}/public/venue/${venueId}/slots?${params.toString()}`);
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

  // Venue Owner SaaS
  async getOwnerContext() {
    const res = await fetch(`${API_BASE}/owner/context`);
    if (!res.ok) throw new Error('Failed to get owner context');
    return res.json();
  },

  async getOwnerAnalytics(venueId) {
    const q = venueId ? `?venueId=${venueId}` : '';
    const res = await fetch(`${API_BASE}/owner/analytics${q}`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  async getOwnerBookings(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/owner/bookings?${q}`);
    if (!res.ok) throw new Error('Failed to fetch bookings');
    return res.json();
  },

  async createWalkInBooking(data) {
    const res = await fetch(`${API_BASE}/owner/walk-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create walk-in');
    return body;
  },

  async updateBookingAction(bookingId, data) {
    const res = await fetch(`${API_BASE}/owner/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Action failed');
    return body;
  },

  async blockSlot(data) {
    const res = await fetch(`${API_BASE}/owner/slots/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async unblockSlot(data) {
    const res = await fetch(`${API_BASE}/owner/slots/unblock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getCustomers() {
    const res = await fetch(`${API_BASE}/owner/crm`);
    if (!res.ok) throw new Error('Failed to load CRM data');
    return res.json();
  },

  async createCourt(data) {
    const res = await fetch(`${API_BASE}/owner/courts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getOwnerVenueDetails(venueId) {
    const res = await fetch(`${API_BASE}/owner/venues/${venueId}`);
    if (!res.ok) throw new Error('Failed to fetch venue details');
    return res.json();
  },

  async updateVenueProfile(venueId, data) {
    const res = await fetch(`${API_BASE}/owner/venues/${venueId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to update venue profile');
    return body;
  },

  async getOwnerLiveSlots(venueId, date) {
    const q = new URLSearchParams({ venueId, date: date || '' }).toString();
    const res = await fetch(`${API_BASE}/owner/live-slots?${q}`);
    if (!res.ok) throw new Error('Failed to fetch live slots');
    return res.json();
  },

  async convertSlotToFullInquiry(slotId, data) {
    const res = await fetch(`${API_BASE}/owner/slots/${slotId}/convert-full-inquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to convert slot to full inquiry');
    return body;
  },

  async updateSlotPrice(slotId, price) {
    const res = await fetch(`${API_BASE}/owner/slots/${slotId}/price`, {
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
    const res = await fetch(`${API_BASE}/owner/upi-pending${q}`);
    if (!res.ok) throw new Error('Failed to fetch pending UPI payments');
    return res.json();
  },

  async verifyUpiPayment(bookingId, { action = 'verify_credit', notes = '' }) {
    const res = await fetch(`${API_BASE}/owner/bookings/${bookingId}/verify-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to verify UPI payment');
    return body;
  },

  async getVenueUpiSettings(venueId) {
    const res = await fetch(`${API_BASE}/owner/venues/${venueId}/upi-settings`);
    if (!res.ok) throw new Error('Failed to fetch UPI settings');
    return res.json();
  },

  async updateVenueUpiSettings(venueId, data) {
    const res = await fetch(`${API_BASE}/owner/venues/${venueId}/upi-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to update UPI settings');
    return body;
  },

  async getConfigInfo() {
    const res = await fetch(`${API_BASE}/config/info`);
    if (!res.ok) return null;
    return res.json();
  },

  // Authentication & Sessions
  async loginPlayer(credentials) {
    const res = await fetch(`${API_BASE}/auth/player/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Player login failed');
    return body;
  },

  async loginOwner(credentials) {
    const res = await fetch(`${API_BASE}/auth/owner/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Owner login failed');
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
  }
};
