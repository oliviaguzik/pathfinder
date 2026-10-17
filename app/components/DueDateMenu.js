"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { parseLocalDate, quickDates } from "../../lib/dates";

function shortDay(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// A task's due date as a button: click it to move the task to Today,
// Tomorrow, Next week, a picked date, or No date. `onPick` gets YYYY-MM-DD or null.
export default function DueDateMenu({ dueDate, className = "", children, onPick }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const quick = quickDates();

  function reposition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector("button")?.focus();
    function handlePointerDown(e) {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function pick(date) {
    setOpen(false);
    if (date !== dueDate) onPick(date);
  }

  const options = [
    { label: "Today", hint: shortDay(quick.today).split(",")[0], date: quick.today },
    { label: "Tomorrow", hint: shortDay(quick.tomorrow).split(",")[0], date: quick.tomorrow },
    { label: "Next week", hint: shortDay(quick.nextWeek), date: quick.nextWeek },
  ];

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`due-menu-trigger ${className}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change date"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) reposition();
          setOpen((o) => !o);
        }}
      >
        {children}
        <Icon name="chevronDown" size={11} />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="menu-panel due-menu"
            role="menu"
            aria-label="Move to"
            style={{ top: coords.top, left: coords.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="due-menu-title">Move to</div>
            {options.map((o) => (
              <button key={o.label} type="button" role="menuitem" className="menu-item" onClick={() => pick(o.date)}>
                {o.label}
                <span className="due-menu-hint">{o.hint}</span>
              </button>
            ))}
            <label className="menu-item due-menu-pick">
              Pick a date…
              <input
                type="date"
                aria-label="Pick a date"
                defaultValue={dueDate || ""}
                onChange={(e) => e.target.value && pick(e.target.value)}
              />
            </label>
            <button type="button" role="menuitem" className="menu-item" onClick={() => pick(null)}>
              No date
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
