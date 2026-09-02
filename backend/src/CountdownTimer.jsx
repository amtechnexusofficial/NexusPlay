import { useEffect, useState } from "react";

function format(ms) {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CountdownTimer({ deadline }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!deadline) return null;
  const remaining = new Date(deadline).getTime() - now;

  return (
    <span className={`countdown ${remaining < 5 * 60 * 1000 ? "countdown--urgent" : ""}`}>
      {remaining <= 0 ? "Finalizing…" : `${format(remaining)} left to fill`}
    </span>
  );
}
