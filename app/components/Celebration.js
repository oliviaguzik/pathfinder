"use client";

import { useEffect, useState } from "react";

const COLORS = ["#ff5470", "#ff9f1c", "#ffd23f", "#3bceac", "#0ead69", "#5390d9", "#7400b8"];

// `trigger` should change (e.g. Date.now()) each time a celebration should fire,
// since a repeated identical value wouldn't re-run the effect.
export default function Celebration({ trigger, message }) {
  const [pieces, setPieces] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setPieces(
      Array.from({ length: 70 }, (_, i) => ({
        id: `${trigger}-${i}`,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.8 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        rotate: Math.round(Math.random() * 360),
        drift: Math.round((Math.random() - 0.5) * 220),
      }))
    );
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div className="celebration-overlay" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--drift": `${p.drift}px`,
            "--rotate": `${p.rotate}deg`,
          }}
        />
      ))}
      {message && <div className="celebration-message">{message}</div>}
    </div>
  );
}
