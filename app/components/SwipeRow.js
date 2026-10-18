"use client";

import { useSwipeRow } from "../../lib/useSwipeRow";

// A row <div> that can be swiped on touch screens (see lib/useSwipeRow).
export default function SwipeRow({ onRight, onLeft, children, ...props }) {
  const swipe = useSwipeRow({ onRight, onLeft });
  return (
    <div {...props} {...swipe}>
      {children}
    </div>
  );
}
