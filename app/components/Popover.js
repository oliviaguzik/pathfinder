"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A button that opens a small panel under it. `bare` shows just the label (e.g.
// an icon) as a ghost button, with `ariaLabel` naming it.
export default function Popover({ label, children, onClear, clearLabel = "Clear", bare = false, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  function reposition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Keep a ~320px panel on screen when the button is near the right edge.
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - 336));
    setCoords({ top: rect.bottom + window.scrollY + 6, left: left + window.scrollX });
  }

  function toggle() {
    if (!open) reposition();
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      // A nested Select's dropdown is its own portal (a DOM sibling, not a
      // descendant of panelRef), so it wouldn't otherwise be recognized as "inside".
      if (e.target.closest(".select-menu")) return;
      setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleReposition() {
      reposition();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  const panel =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div ref={panelRef} className="popover-panel" style={{ top: coords.top, left: coords.left }}>
        {children}
      </div>,
      document.body
    );

  if (bare) {
    return (
      <>
        <button
          type="button"
          ref={triggerRef}
          className="ghost icon-btn popover-bare-trigger"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={ariaLabel}
          title={ariaLabel}
          onClick={toggle}
        >
          {label}
        </button>
        {panel}
      </>
    );
  }

  return (
    <>
      <div className="trigger-with-clear">
        <button
          type="button"
          ref={triggerRef}
          className="popover-trigger"
          aria-haspopup="true"
          aria-expanded={open}
          onClick={toggle}
        >
          {label}
        </button>
        {onClear && (
          <button
            type="button"
            className="inline-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label={clearLabel}
            title={clearLabel}
          >
            ×
          </button>
        )}
      </div>
      {panel}
    </>
  );
}
