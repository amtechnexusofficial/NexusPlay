import CountdownTimer from "./CountdownTimer.jsx";
import { Users, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const STATUS_META = {
  open: { label: "Open", color: "#6B6A63" },
  pooling: { label: "Filling up", color: "#B8860B" },
  confirmed_pool: { label: "Confirmed", color: "#5C8A00" },
  confirmed_full: { label: "Booked out", color: "#6B6A63" },
};

export default function SlotCard({ slot, onJoin, onBookFull, busy }) {
  const meta = STATUS_META[slot.status];
  const joinedCount = slot.joinedPlayers?.length ?? slot.joined?.length ?? 0;
  const spotsLeft = Math.max(slot.minPlayers - joinedCount, 0);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: 18,
        opacity: slot.status === "confirmed_full" ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
            {slot.startTime}–{slot.endTime}
          </div>
          <div style={{ color: meta.color, fontSize: 12, fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {meta.label}
          </div>
        </div>
        <div
          style={{
            background: "var(--ink)",
            color: "var(--lime)",
            borderRadius: 999,
            padding: "6px 12px",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          ₹{slot.fullPrice}
        </div>
      </div>

      {slot.status === "pooling" && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: slot.minPlayers }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < joinedCount ? "var(--lime-deep)" : "var(--surface)" }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            <span><Users size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{joinedCount}/{slot.minPlayers} joined · {spotsLeft} left</span>
            <span><Clock size={12} style={{ verticalAlign: -2, marginRight: 3 }} /><CountdownTimer deadline={slot.poolDeadline || slot.deadline} /></span>
          </div>
          {slot.fullBookingRequest && (
            <div style={{ marginTop: 10, background: "#FFF7E0", border: "1px solid #E8C34A", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#8A6A00", display: "flex", gap: 6 }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Someone offered to book this whole slot — waiting on the owner to decide.
            </div>
          )}
        </div>
      )}

      {slot.status === "confirmed_pool" && (
        <div style={{ marginTop: 12, color: "#5C8A00", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={15} /> Locked in — {joinedCount}/{slot.minPlayers} players confirmed
        </div>
      )}

      {slot.status === "confirmed_full" && (
        <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <XCircle size={15} /> Booked by {slot.fullBooking?.name}
        </div>
      )}

      {(slot.status === "open" || slot.status === "pooling") && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button disabled={busy} onClick={() => onJoin(slot.id)} className="btn-primary" style={{ flex: 1 }}>
            Join · ₹{slot.pricePerPlayer}
          </button>
          <button disabled={busy} onClick={() => onBookFull(slot.id)} className="btn-outline" style={{ flex: 1 }}>
            Book full
          </button>
        </div>
      )}
    </div>
  );
}
