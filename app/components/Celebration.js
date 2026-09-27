"use client";

import { useEffect, useState } from "react";

const COLORS = ["#ff5470", "#ff9f1c", "#ffd23f", "#3bceac", "#0ead69", "#5390d9", "#c86dd7"];
const SHAPES = ["rect", "circle", "ribbon"];

function makePiece(trigger, i) {
  const shape = SHAPES[i % SHAPES.length];
  const size = 6 + Math.round(Math.random() * 6);
  return {
    id: `${trigger}-${i}`,
    // Full-width curtain across the whole page, staggered entry and a long,
    // slow drift down — a leisurely full-page moment rather than a quick pop.
    left: Math.random() * 100,
    drift: Math.round((Math.random() - 0.5) * 220),
    delay: Math.random() * 1.4,
    fallDuration: 4 + Math.random() * 2.6,
    spinDuration: 0.9 + Math.random() * 1.1,
    color: COLORS[i % COLORS.length],
    shape,
    width: shape === "ribbon" ? size * 0.5 : size,
    height: shape === "ribbon" ? size * 1.8 : shape === "circle" ? size : size * 1.3,
  };
}

// `trigger` should change (e.g. Date.now()) each time a celebration should fire,
// since a repeated identical value wouldn't re-run the effect. The message
// banner has its own, shorter lifetime than the confetti — it shouldn't have
// to sit on screen for as long as the confetti takes to finish falling.
export default function Celebration({ trigger, message, subtitle }) {
  const [pieces, setPieces] = useState([]);
  const [phase, setPhase] = useState(null); // null | "active" — confetti overlay lifetime
  const [messagePhase, setMessagePhase] = useState("hidden"); // "shown" | "leaving" | "hidden"

  useEffect(() => {
    if (!trigger) return;
    setPieces(Array.from({ length: 140 }, (_, i) => makePiece(trigger, i)));
    setPhase("active");
    setMessagePhase("shown");

    const messageLeaveTimer = setTimeout(() => setMessagePhase("leaving"), 1800);
    const messageHideTimer = setTimeout(() => setMessagePhase("hidden"), 2100);
    const endTimer = setTimeout(() => setPhase(null), 5700);
    return () => {
      clearTimeout(messageLeaveTimer);
      clearTimeout(messageHideTimer);
      clearTimeout(endTimer);
    };
  }, [trigger]);

  if (!phase) return null;

  return (
    <div className="celebration-overlay" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.fallDuration}s`,
            "--drift": `${p.drift}px`,
          }}
        >
          <span
            className="confetti-piece-inner"
            style={{
              backgroundColor: p.color,
              width: p.width,
              height: p.height,
              borderRadius: p.shape === "circle" ? "50%" : "2px",
              animationDuration: `${p.spinDuration}s`,
            }}
          />
        </span>
      ))}
      {message && messagePhase !== "hidden" && (
        <div className={`celebration-message ${messagePhase === "leaving" ? "leaving" : ""}`}>
          <div className="celebration-message-title">{message}</div>
          {subtitle && <div className="celebration-message-subtitle">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}
