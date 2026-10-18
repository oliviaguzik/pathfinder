"use client";

import { useEffect } from "react";

// Turns on the background script (public/sw.js) in the live app. It stays off
// while developing, where it would get in the way of instant reloads.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
