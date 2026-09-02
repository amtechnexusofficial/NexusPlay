import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import Brand from "../components/Brand.jsx";
import { LogOut, Users, IndianRupee, Percent, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

const MONTHLY_REVENUE = [
  { month: "Jan", revenue: 32000 }, { month: "Feb", revenue: 24000 }, { month: "Mar", revenue: 41000 },
  { month: "Apr", revenue: 28000 }, { month: "May", revenue: 52000 }, { month: "Jun", revenue: 46000 },
];

export default function OwnerView({ session, turf, onTurfUpdate, onLogout, pushToast }) {
  const [tab, setTab] = useState("overview");
  const [slots, setSlots] = useState([]);
  const [activity, setActivity] = useState([]);
  const [newSlot, setNewSlot] = useState({ date: "", startTime: "", endTime: "", fullPrice: 800, minPlayers: 8 });

  const refresh = useCallback(() => {
    if (!turf) return;
    api.listSlots(turf.id).then(setSlots).catch(() => {});
    api.listActivity(session.token).then(setActivity).catch(() => {});
  }, [turf, session.token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const pending = slots.filter((s) => s.fullBookingRequest);
  const bookingsToday = slots.filter((s) => s.status === "confirmed_full" || s.status === "confirmed_pool").length;
  const fillRate = slots.length ? Math.round((slots.filter((s) => s.status !== "open").length / slots.length) * 100) : 0;
  const revenueToday = slots.reduce((sum, s) => {
    if (s.status === "confirmed_full") return sum + s.fullPrice;
    if (s.status === "confirmed_pool" || s.status === "pooling") return sum + s.pricePerPlayer * (s.joinedPlayers?.length || 0);
    return sum;
  }, 0);

  async function act(fn, msg, kind = "info") {
    try {
      await fn();
      pushToast(msg, kind);
      refresh();
    } catch (e) {
      pushToast(e.message, "error");
    }
  }

  async function handleAddSlot(e) {
    e.preventDefault();
    await act(() => api.createSlot(turf.id, newSlot, session.token), "Slot added.", "success");
    setNewSlot({ ...newSlot, startTime: "", endTime: "" });
  }

  return (
    <div>
      <header style={{ padding: "20px 18px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Brand turf={turf} />
        <button onClick={onLogout} style={{ background: "none", border: "none", color: "#6B6A63", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12 }}>
          <LogOut size={13} /> Log out
        </button>
      </header>

      <div style={{ display: "flex", gap: 2, background: "var(--surface)", borderRadius: 999, padding: 3, margin: "14px 18px 0" }}>
        {[{ key: "overview", label: "Overview" }, { key: "slots", label: "Slots" }, { key: "activity", label: "Activity" }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", background: tab === t.key ? "var(--ink)" : "transparent", color: tab === t.key ? "var(--lime)" : "#6B6A63" }}>
            {t.label}
          </button>
        ))}
      </div>

      <main style={{ padding: 18 }}>
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatCard icon={<IndianRupee size={14} />} label="Revenue today" value={`₹${revenueToday.toLocaleString("en-IN")}`} />
              <StatCard icon={<Users size={14} />} label="Bookings today" value={bookingsToday} />
              <StatCard icon={<Percent size={14} />} label="Fill rate" value={`${fillRate}%`} />
              <StatCard icon={<Zap size={14} />} label="Pending approvals" value={pending.length} accent={pending.length > 0} />
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Monthly revenue</div>
              <div style={{ background: "var(--surface)", borderRadius: 14, padding: "16px 8px 8px" }}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={MONTHLY_REVENUE} margin={{ left: -20 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="month" tick={{ fill: "#6B6A63", fontSize: 11 }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                    <YAxis tick={{ fill: "#6B6A63", fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                    <Bar dataKey="revenue" fill="#8FCB00" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {pending.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Needs your decision</div>
                {pending.map((s) => (
                  <div key={s.id} style={{ background: "#FFF7E0", border: "1px solid #E8C34A", borderRadius: 14, padding: 14, marginTop: 8 }}>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                      <strong>{s.fullBookingRequest.name}</strong> wants {s.startTime}–{s.endTime} for ₹{s.fullBookingRequest.amount}, but {s.joinedPlayers.length}/{s.minPlayers} already paid into the pool.
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={() => act(() => api.acceptFullBooking(s.id, session.token), "Accepted — pool refunded.", "success")}>Accept & refund pool</button>
                      <button className="btn-outline" style={{ flex: 1 }} onClick={() => act(() => api.declineFullBooking(s.id, session.token), "Declined.", "info")}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "slots" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {slots.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", borderRadius: 10, padding: "10px 12px" }}>
                  <div>
                    <div className="display" style={{ fontSize: 16, fontWeight: 700 }}>{s.startTime}–{s.endTime}</div>
                    <div style={{ fontSize: 11.5, color: "#6B6A63", textTransform: "capitalize" }}>{s.status.replace("_", " ")} · {s.joinedPlayers?.length || 0}/{s.minPlayers} filled</div>
                  </div>
                  {s.status !== "open" && (
                    <button className="btn-outline" style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => act(() => api.cancelSlot(s.id, session.token), "Slot reset.", "info")}>Reset</button>
                  )}
                </div>
              ))}
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Add a slot</div>
              <form onSubmit={handleAddSlot} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <input type="date" value={newSlot.date} onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })} required style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
                <input type="time" value={newSlot.startTime} onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })} required style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
                <input type="time" value={newSlot.endTime} onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })} required style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
                <input type="number" placeholder="Price ₹" value={newSlot.fullPrice} onChange={(e) => setNewSlot({ ...newSlot, fullPrice: e.target.value })} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: 90 }} />
                <input type="number" placeholder="Min players" value={newSlot.minPlayers} onChange={(e) => setNewSlot({ ...newSlot, minPlayers: e.target.value })} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: 100 }} />
                <button type="submit" className="btn-primary">Add slot</button>
              </form>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div>
            {activity.map((a) => (
              <div key={a.id} style={{ padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 12.5, color: "#6B6A63" }}>
                <span style={{ color: "var(--ink)" }}>{new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> {a.message}
              </div>
            ))}
            {activity.length === 0 && <div style={{ color: "#6B6A63", fontSize: 13 }}>Nothing yet.</div>}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 12, padding: 13, border: accent ? "1.5px solid var(--lime-deep)" : "1px solid transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#6B6A63", fontSize: 11 }}>{icon} {label}</div>
      <div className="display" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}
