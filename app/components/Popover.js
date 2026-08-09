"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function Popover({ label, children, onClear, clearLabel = "Clear" }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  function reposition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX });
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
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div ref={panelRef} className="popover-panel" style={{ top: coords.top, left: coords.left }}>
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
