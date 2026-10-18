"use client";

import { useEffect, useRef, useState } from "react";

// How far (after the resistance) the indicator must come down to reload.
const RELOAD_AT = 60;

// Pull down at the top of a page to reload it, like Mail. Only in the app
// added to the Home Screen: there's no browser around it with its own reload,
// and Safari tabs already do this themselves.
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [reloading, setReloading] = useState(false);
  const start = useRef(null);
  const pulled = useRef(0);

  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (!installed) return;

    function onStart(e) {
      // Not while a sheet or tour is open, and only from the very top.
      if (window.scrollY > 0 || document.querySelector(".modal, .tour-layer")) return;
      start.current = e.touches[0].clientY;
    }
    function onMove(e) {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        start.current = null;
        pulled.current = 0;
        setPull(0);
        return;
      }
      // Moves at half the finger's speed, so it resists like the real thing.
      pulled.current = Math.min(120, dy * 0.5);
      setPull(pulled.current);
    }
    function onEnd() {
      if (start.current === null) return;
      start.current = null;
      if (pulled.current >= RELOAD_AT) {
        setReloading(true);
        window.location.reload();
      } else {
        pulled.current = 0;
        setPull(0);
      }
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  if (!pull && !reloading) return null;
  const ready = pull >= RELOAD_AT;
  return (
    <div className="ptr" style={{ transform: `translateY(${pull}px)` }} aria-hidden="true">
      <span className={`ptr-spinner ${ready || reloading ? "ready" : ""} ${reloading ? "spinning" : ""}`} style={{ transform: `rotate(${pull * 4}deg)` }} />
    </div>
  );
}
