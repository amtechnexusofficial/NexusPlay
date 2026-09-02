import { useState } from "react";
import { api } from "../api.js";

const inputStyle = {
  background: "#F4F3EE",
  border: "1px solid rgba(18,19,15,0.12)",
  borderRadius: 10,
  padding: "13px 14px",
  color: "#12130F",
  fontSize: 14.5,
};

export default function Onboarding({ token, onDone, pushToast }) {
  const [form, setForm] = useState({ name: "", location: "", websiteUrl: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.location) return;
    setSubmitting(true);
    try {
      let logoUrl;
      if (logoFile) {
        const uploaded = await api.uploadLogo(logoFile, token);
        logoUrl = uploaded.url;
      }
      const turf = await api.createTurf({ ...form, logoUrl }, token);
      pushToast?.("Turf created — your branding is live.", "success");
      onDone(turf);
    } catch (err) {
      pushToast?.(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "48px 24px", minHeight: "100vh", background: "#fff" }}>
      <div className="eyebrow">Owner setup</div>
      <div className="display" style={{ fontSize: 34, fontWeight: 700, marginTop: 4, marginBottom: 6 }}>
        Set up your turf
      </div>
      <div style={{ color: "#6B6A63", fontSize: 13.5, marginBottom: 28 }}>
        This shows up on your booking page, receipts, and dashboard — everywhere players see you.
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="eyebrow">Business name</span>
          <input required style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Green Zone Turf" />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="eyebrow">Location</span>
          <input required style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Madurai, TN" />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="eyebrow">Website (optional)</span>
          <input style={inputStyle} value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://yourturf.com" />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="eyebrow">Logo (optional)</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {logoPreview && <img src={logoPreview} alt="Logo preview" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoChange} style={{ fontSize: 12.5 }} />
          </div>
        </label>

        <button type="submit" disabled={submitting || !form.name || !form.location} className="btn-primary" style={{ marginTop: 8, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Creating…" : "Create my turf"}
        </button>
      </form>
    </div>
  );
}
