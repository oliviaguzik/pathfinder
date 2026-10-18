"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../lib/AuthProvider";
import { hasSeenTour, markTourSeen, onTourRestart } from "../../lib/tourState";
import { useIsPhone } from "./useIsPhone";
import { TOURS } from "./tours";

// The first element matching `selector` that's actually on screen.
function visibleTarget(selector) {
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

// A page's first-visit tour (steps in tours.js): the page dims except the part
// being explained, with a small bubble and Back / Next / Skip. It starts once
// the page has loaded (`ready`), runs once per account, and runs again from
// "Tour of this page" (nav ? / phone menu), for this page only. Escape skips; arrow keys step.
export default function PageTour({ id, ready = true }) {
  const { user } = useAuth();
  const isPhone = useIsPhone();
  const [steps, setSteps] = useState(null);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState(null);
  const [bubblePos, setBubblePos] = useState(null);
  const [restarts, setRestarts] = useState(0);
  const bubbleRef = useRef(null);
  const nextRef = useRef(null);

  useEffect(() => onTourRestart(() => setRestarts((n) => n + 1)), []);

  // Start: after the page has loaded and settled, with the steps whose targets
  // are on screen (so "2 of 3" is right).
  useEffect(() => {
    if (!ready || !user || steps) return;
    if (restarts === 0 && hasSeenTour(user, id)) return;
    const timer = setTimeout(() => {
      if (document.querySelector(".modal")) return;
      const found = (TOURS[id] || []).filter((s) => visibleTarget(s.target));
      if (found.length) {
        setIndex(0);
        setSteps(found);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [ready, user, id, restarts, steps]);

  const step = steps?.[index];

  function finish() {
    setSteps(null);
    setSpot(null);
    setBubblePos(null);
    setRestarts(0);
    markTourSeen(user, id);
  }

  function next() {
    if (index + 1 < steps.length) setIndex(index + 1);
    else finish();
  }

  function back() {
    if (index > 0) setIndex(index - 1);
  }

  // Light up the step's target and put the bubble below it (or above, if
  // there's no room), kept on screen.
  useLayoutEffect(() => {
    if (!step) return;
    const el = visibleTarget(step.target);
    if (!el) return;
    const first = el.getBoundingClientRect();
    if (first.top < 70 || first.bottom > window.innerHeight - 100) el.scrollIntoView({ block: "center" });

    function place() {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 6;
      const top = Math.max(8, r.top - pad);
      const bottom = Math.min(vh - 8, r.bottom + pad);
      const lit = { top, left: Math.max(8, r.left - pad), width: Math.min(vw - 16, r.width + pad * 2), height: Math.max(0, bottom - top) };
      setSpot(lit);
      const bh = bubbleRef.current?.offsetHeight || 180;
      const bw = bubbleRef.current?.offsetWidth || 320;
      let bt;
      if (lit.top + lit.height + 12 + bh <= vh - 8) bt = lit.top + lit.height + 12;
      else if (lit.top - 12 - bh >= 8) bt = lit.top - 12 - bh;
      else bt = vh - bh - 16;
      setBubblePos({ top: bt, left: Math.max(16, Math.min(lit.left, vw - bw - 16)) });
    }
    place();
    const again = setTimeout(place, 50);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      clearTimeout(again);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [step, isPhone]);

  useEffect(() => {
    if (!step) return;
    nextRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!step || typeof document === "undefined") return null;
  const last = index === steps.length - 1;

  return createPortal(
    <div className="tour-layer" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-blocker" />
      {spot && <div className="tour-spot" style={spot} />}
      <div className="tour-bubble" ref={bubbleRef} style={bubblePos || { visibility: "hidden" }}>
        <p className="tour-count">
          {index + 1} of {steps.length}
        </p>
        <h3 id="tour-title" className="tour-title">{step.title}</h3>
        <p className="tour-body">{isPhone && step.phoneBody ? step.phoneBody : step.body}</p>
        <div className="tour-actions">
          <button type="button" className="ghost small-btn" onClick={finish}>
            Skip tour
          </button>
          <span className="tour-actions-right">
            {index > 0 && (
              <button type="button" className="ghost" onClick={back}>
                Back
              </button>
            )}
            <button type="button" className="primary" ref={nextRef} onClick={next}>
              {last ? "Got it" : "Next"}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
