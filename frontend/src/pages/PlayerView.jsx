import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import SlotCard from "../components/SlotCard.jsx";
import Brand from "../components/Brand.jsx";
import { LogOut } from "lucide-react";

export default function PlayerView({ session, turf, onLogout, pushToast }) {
  const [tab, setTab] = useState("book");
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!turf) return;
    api.listSlots(turf.id).then(setSlots).catch(() => {});
  }, [turf]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000); // poll — swap for websockets/SSE in production
    return () => clearInterval(id);
  }, [refresh]);

  async function handleJoin(slotId) {
    setBusy(true);
    try {
      await api.joinSlot(slotId, session.token);
      pushToast("You're in — we'll confirm once the group fills up.", "success");
      refresh();
    } catch (e) {
      pushToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleBookFull(slotId) {
    setBusy(true);
    try {
      const result = await api.bookFullSlot(slotId, session.token);
      pushToast(result.pendingApproval ? "Request sent to the turf owner." : "Slot booked!", result.pendingApproval ? "info" : "success");
      refresh();
    } catch (e) {
      pushToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const myBookings = slots.filter((s) => s.joinedPlayers?.some((p) => p.name === session.user.name) || s.fullBooking?.name === session.user.name);

  return (
    <div>
      <header style={{ padding: "20px 18px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Brand turf={turf} />
        <button onClick={onLogout} style={{ background: "none", border: "none", color: "#6B6A63", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12 }}>
          <LogOut size={13} /> Log out
        </button>
      </header>

      <div style={{ display: "flex", gap: 2, background: "var(--surface)", borderRadius: 999, padding: 3, margin: "14px 18px 0" }}>
        {[{ key: "book", label: "Book a slot" }, { key: "mine", label: "My bookings" }].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", background: tab === t.key ? "var(--ink)" : "transparent", color: tab === t.key ? "var(--lime)" : "#6B6A63" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {tab === "book"
          ? slots.map((s) => <SlotCard key={s.id} slot={s} onJoin={handleJoin} onBookFull={handleBookFull} busy={busy} />)
          : myBookings.length === 0
          ? <div style={{ color: "#6B6A63", fontSize: 13.5, textAlign: "center", padding: "40px 0" }}>No bookings yet — join or book a slot from the Book tab.</div>
          : myBookings.map((s) => (
              <div key={s.id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 16 }}>
                <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>{s.startTime}–{s.endTime}</div>
                <div style={{ fontSize: 12, color: "#6B6A63", marginTop: 2, textTransform: "capitalize" }}>{s.status.replace("_", " ")}</div>
              </div>
            ))}
        {tab === "book" && slots.length === 0 && <p style={{ color: "#6B6A63", fontSize: 13.5 }}>No slots yet for this turf.</p>}
      </main>
    </div>
  );
}
