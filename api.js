const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

async function request(path, options = {}, token) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  // --- auth ---
  requestOtp: (phone, role) => request("/api/auth/request-otp", { method: "POST", body: JSON.stringify({ phone, role }) }),
  verifyOtp: (phone, code, role, name) =>
    request("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, code, role, name }) }),

  // --- turfs ---
  getTurf: (turfId) => request(`/api/turfs/${turfId}`),
  listTurfs: () => request("/api/turfs"),
  myTurfs: (token) => request("/api/turfs/mine", {}, token),
  createTurf: (body, token) => request("/api/turfs", { method: "POST", body: JSON.stringify(body) }, token),
  updateTurf: (turfId, body, token) => request(`/api/turfs/${turfId}`, { method: "PATCH", body: JSON.stringify(body) }, token),

  // --- logo upload (multipart — do NOT set Content-Type manually, the browser sets the boundary) ---
  async uploadLogo(file, token) {
    const form = new FormData();
    form.append("logo", file);
    const res = await fetch(`${BASE_URL}/api/uploads/logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data; // { url }
  },

  // --- slots ---
  listSlots: (turfId) => request(`/api/turfs/${turfId}/slots`),
  createSlot: (turfId, body, token) => request(`/api/turfs/${turfId}/slots`, { method: "POST", body: JSON.stringify(body) }, token),

  // --- player actions (identity comes from the token) ---
  joinSlot: (slotId, token) => request(`/api/slots/${slotId}/join`, { method: "POST" }, token),
  bookFullSlot: (slotId, token) => request(`/api/slots/${slotId}/book-full`, { method: "POST" }, token),

  // --- owner actions ---
  acceptFullBooking: (slotId, token) => request(`/api/slots/${slotId}/owner/accept-full`, { method: "POST" }, token),
  declineFullBooking: (slotId, token) => request(`/api/slots/${slotId}/owner/decline-full`, { method: "POST" }, token),
  cancelSlot: (slotId, token) => request(`/api/slots/${slotId}/owner/cancel`, { method: "POST" }, token),
  listActivity: (token) => request("/api/owner/activity", {}, token),
};
