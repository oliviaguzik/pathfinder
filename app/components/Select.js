"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function Select({ id, value, onChange, options, ariaLabel, onClear, clearLabel = "Clear" }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selectedIndex = normalized.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? normalized[selectedIndex] : null;

  function reposition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
  }

  function openMenu() {
    reposition();
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (open) menuRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function handleScrollOrResize() {
      reposition();
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  function selectOption(opt) {
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(e) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  }

  function handleMenuKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, normalized.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (normalized[activeIndex]) selectOption(normalized[activeIndex]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <>
      <div className="trigger-with-clear">
        <button
          type="button"
          id={id}
          ref={triggerRef}
          className={`select-trigger ${onClear ? "has-clear" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className={selected ? "select-value" : "select-value select-placeholder"}>
            {selected ? selected.label : "Select..."}
          </span>
          <span className="select-caret">▾</span>
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
          <div
            ref={menuRef}
            className="select-menu"
            role="listbox"
            tabIndex={-1}
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            onKeyDown={handleMenuKeyDown}
          >
            {normalized.map((opt, i) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`select-option ${opt.value === value ? "selected" : ""} ${i === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => selectOption(opt)}
              >
                {opt.label}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
