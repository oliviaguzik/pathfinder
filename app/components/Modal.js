"use client";

import { useEffect, useRef } from "react";

// A dialog; on phones it's a sheet from the bottom that can be swiped down to
// close, like the iPhone's own sheets (from the handle / title, or from the
// content when it's scrolled to the top).
export default function Modal({ open, onClose, title, children }) {
  const sheetRef = useRef(null);
  const bodyRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  function onTouchStart(e) {
    if (!window.matchMedia("(max-width: 600px)").matches) return;
    const fromBody = bodyRef.current?.contains(e.target);
    if (fromBody && bodyRef.current.scrollTop > 0) return;
    drag.current = { startY: e.touches[0].clientY, startTime: Date.now(), dy: 0, fromBody };
  }

  function onTouchMove(e) {
    const d = drag.current;
    if (!d) return;
    const dy = e.touches[0].clientY - d.startY;
    // Dragging up inside the content scrolls it as normal.
    if (d.fromBody && dy < 0 && d.dy === 0) {
      drag.current = null;
      return;
    }
    d.dy = Math.max(0, dy);
    const sheet = sheetRef.current;
    sheet.style.transition = "none";
    sheet.style.transform = `translateY(${d.dy}px)`;
  }

  function onTouchEnd() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const sheet = sheetRef.current;
    const fast = d.dy / Math.max(1, Date.now() - d.startTime) > 0.5;
    sheet.style.transition = "transform 0.22s cubic-bezier(0.2, 0.8, 0.3, 1)";
    if (d.dy > 110 || (fast && d.dy > 30)) {
      sheet.style.transform = "translateY(100%)";
      setTimeout(onClose, 200);
    } else {
      sheet.style.transform = "";
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="ghost modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
