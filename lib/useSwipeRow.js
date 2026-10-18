"use client";

import { useRef } from "react";

// How far a row must be swiped (px) before letting go does the action.
const ACT_AT = 90;

// Swipe a row sideways on a touch screen, like Mail and Reminders: right
// (`onRight`, e.g. tick off) or left (`onLeft`, e.g. delete). The row slides
// with the finger over a coloured strip naming the action (CSS
// .swipe-right / .swipe-left, width from --swipe). A mostly-vertical drag is
// left alone so the page still scrolls, and the tap that ends a swipe doesn't
// also open the row. Spread the result onto the row element.
export function useSwipeRow({ onRight, onLeft }) {
  const swipe = useRef(null);
  const justSwiped = useRef(false);

  function reset(el, animate) {
    el.style.transition = animate ? "transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1)" : "";
    el.style.transform = "";
    el.classList.remove("swipe-right", "swipe-left", "swipe-ready");
    el.style.removeProperty("--swipe");
  }

  return {
    onTouchStart(e) {
      if (!onRight && !onLeft) return;
      if (e.target.closest("button, input, select, a")) return;
      const t = e.touches[0];
      swipe.current = { x: t.clientX, y: t.clientY, dx: 0, sideways: null };
    },
    onTouchMove(e) {
      const s = swipe.current;
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (s.sideways === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.sideways = Math.abs(dx) > Math.abs(dy) * 1.4;
      }
      if (!s.sideways) {
        swipe.current = null;
        return;
      }
      // Only the directions this row has an action for.
      s.dx = (dx > 0 && !onRight) || (dx < 0 && !onLeft) ? 0 : dx;
      const el = e.currentTarget;
      el.style.transition = "none";
      el.style.transform = `translateX(${s.dx}px)`;
      el.style.setProperty("--swipe", `${Math.abs(s.dx)}px`);
      el.classList.toggle("swipe-right", s.dx > 0);
      el.classList.toggle("swipe-left", s.dx < 0);
      el.classList.toggle("swipe-ready", Math.abs(s.dx) >= ACT_AT);
    },
    onTouchEnd(e) {
      const s = swipe.current;
      swipe.current = null;
      if (!s?.sideways) return;
      justSwiped.current = true;
      setTimeout(() => (justSwiped.current = false), 350);
      const el = e.currentTarget;
      if (s.dx >= ACT_AT) {
        reset(el, true);
        onRight();
      } else if (s.dx <= -ACT_AT) {
        // Slides away first, then goes.
        el.style.transition = "transform 0.18s ease-in";
        el.style.transform = "translateX(-110%)";
        setTimeout(() => {
          reset(el, false);
          onLeft();
        }, 170);
      } else {
        reset(el, true);
      }
    },
    onTouchCancel(e) {
      swipe.current = null;
      reset(e.currentTarget, true);
    },
    onClickCapture(e) {
      if (justSwiped.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };
}
