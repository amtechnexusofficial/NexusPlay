import { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";
import Onboarding from "./pages/Onboarding.jsx";
import PlayerApp from "./pages/PlayerView.jsx";
import OwnerApp from "./pages/OwnerView.jsx";
import Notification from "./components/Notification.jsx";
import { ArrowLeft } from "lucide-react";

function loadSession() {
  try {
    const token = localStorage.getItem("thidal_token");
    const user = JSON.parse(localStorage.getItem("thidal_user") || "null");
    if (token && user) return { token, user };
  } catch {}
  return null;
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [turf, setTurf] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((msg, kind = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const login = useCallback((token, user) => {
    localStorage.setItem("thidal_token", token);
    localStorage.setItem("thidal_user", JSON.stringify(user));
    setSession({ token, user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("thidal_token");
    localStorage.removeItem("thidal_user");
    setSession(null);
    setTurf(null);
  }, []);

  // resolve which turf to show once we know who's signed in
  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        if (session.user.role === "owner") {
          const mine = await api.myTurfs(session.token);
          if (mine.length === 0) {
            setNeedsOnboarding(true);
          } else {
            setTurf(mine[0]);
            setNeedsOnboarding(false);
          }
        } else {
          const all = await api.listTurfs();
          if (all[0]) setTurf(all[0]);
        }
      } catch (e) {
        pushToast(e.message, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [session, pushToast]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6A63" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        ::selection { background: #C6FF3C; color: #12130F; }
      `}</style>

      <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", width: "min(420px, 92vw)", zIndex: 40, display: "flex", flexDirection: "column", gap: 6 }}>
        <Notification items={toasts} />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", position: "relative" }}>
        {!session ? (
          <AuthFlow onLogin={login} pushToast={pushToast} />
        ) : needsOnboarding ? (
          <Onboarding token={session.token} pushToast={pushToast} onDone={(t) => { setTurf(t); setNeedsOnboarding(false); }} />
        ) : session.user.role === "player" ? (
          <PlayerApp session={session} turf={turf} onLogout={logout} pushToast={pushToast} />
        ) : (
          <OwnerApp session={session} turf={turf} onTurfUpdate={setTurf} onLogout={logout} pushToast={pushToast} />
        )}
      </div>
    </div>
  );
}

function AuthFlow({ onLogin, pushToast }) {
  const [step, setStep] = useState("choose"); // choose | phone | otp
  const [role, setRole] = useState(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (!phone || !name) return;
    setBusy(true);
    try {
      const res = await api.requestOtp(phone, role);
      if (res.devCode) setDevCode(res.devCode); // preview convenience — no real SMS provider wired up
      setStep("otp");
    } catch (e) {
      pushToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (otp.length < 4) return;
    setBusy(true);
    try {
      const { token, user } = await api.verifyOtp(phone, otp, role, name);
      onLogin(token, user);
    } catch (e) {
      pushToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (step === "choose") {
    return (
      <div style={{ padding: "64px 24px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="display" style={{ fontSize: 52, fontWeight: 800, lineHeight: 0.95 }}>Thidal</div>
        <div style={{ color: "#6B6A63", fontSize: 14, marginTop: 10, marginBottom: 44, maxWidth: 320 }}>
          Book turfs instantly, split with strangers if you're short a few players, and never chase a refund.
        </div>

        <button onClick={() => { setRole("player"); setStep("phone"); }} style={{ textAlign: "left", background: "#F4F3EE", border: "1px solid var(--line)", borderRadius: 16, padding: 20, marginBottom: 12, cursor: "pointer" }}>
          <div className="display" style={{ fontSize: 21, fontWeight: 700 }}>I'm here to play</div>
          <div style={{ color: "#6B6A63", fontSize: 12.5, marginTop: 3 }}>Book a slot or join one with strangers</div>
        </button>

        <button onClick={() => { setRole("owner"); setStep("phone"); }} style={{ textAlign: "left", background: "#12130F", color: "#fff", border: "none", borderRadius: 16, padding: 20, cursor: "pointer" }}>
          <div className="display" style={{ fontSize: 21, fontWeight: 700, color: "#C6FF3C" }}>I run this turf</div>
          <div style={{ color: "#B7B6AE", fontSize: 12.5, marginTop: 3 }}>Onboard your business & manage bookings</div>
        </button>

        <div style={{ flex: 1 }} />
        <div className="stat-strip">
          <div className="stat-strip__item"><div className="num">600+</div><div className="label">Bookings</div></div>
          <div className="stat-strip__item"><div className="num">3</div><div className="label">Live turfs</div></div>
          <div className="stat-strip__item"><div className="num">TN</div><div className="label">& growing</div></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "56px 24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <button onClick={() => setStep(step === "otp" ? "phone" : "choose")} style={{ background: "none", border: "none", color: "#6B6A63", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: 0, marginBottom: 32, fontSize: 13 }}>
        <ArrowLeft size={15} /> Back
      </button>

      <div className="eyebrow">{role === "owner" ? "Owner login" : "Player login"}</div>
      <div className="display" style={{ fontSize: 30, fontWeight: 700, marginTop: 4, marginBottom: 24 }}>
        {step === "phone" ? "Who's booking?" : "Enter the code"}
      </div>

      {step === "phone" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="eyebrow">Your name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun Kumar" style={{ background: "#F4F3EE", border: "1px solid var(--line)", borderRadius: 10, padding: "13px 14px", fontSize: 14.5 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="eyebrow">Phone number</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" style={{ background: "#F4F3EE", border: "1px solid var(--line)", borderRadius: 10, padding: "13px 14px", fontSize: 14.5 }} />
          </label>
          <button disabled={!phone || !name || busy} onClick={sendCode} className="btn-primary" style={{ marginTop: 6, opacity: !phone || !name ? 0.5 : 1 }}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ color: "#6B6A63", fontSize: 13 }}>Sent to {phone}{devCode ? ` — preview code: ${devCode}` : ""}</div>
          <input autoFocus value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="• • • •" style={{ background: "#F4F3EE", border: "1px solid var(--line)", borderRadius: 10, padding: "13px 14px", fontSize: 16, letterSpacing: 6 }} />
          <button disabled={otp.length < 4 || busy} onClick={verify} className="btn-primary" style={{ opacity: otp.length < 4 ? 0.5 : 1 }}>
            {busy ? "Verifying…" : role === "owner" ? "Go to dashboard" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}
