"use client";

import { useEffect, useState } from "react";
import { notifyError, onNotify } from "../../lib/notify";

const SHOW_MS = { error: 8000, warning: 4000 };
const OFFLINE_MESSAGE = "You're offline. Changes won't save until you reconnect.";

// Shows errors (red) and warnings (amber) at the bottom of the screen, and
// stays up while the browser is offline.
export default function ErrorToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer;
    const unsubscribe = onNotify((next) => {
      setToast(next);
      clearTimeout(timer);
      if (next.message !== OFFLINE_MESSAGE) {
        timer = setTimeout(() => setToast(null), SHOW_MS[next.kind] || SHOW_MS.error);
      }
    });
    function handleOffline() {
      notifyError(OFFLINE_MESSAGE);
    }
    function handleOnline() {
      setToast((current) => (current?.message === OFFLINE_MESSAGE ? null : current));
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    if (!navigator.onLine) handleOffline();
    return () => {
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!toast) return null;
  return (
    <div className={`app-toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
      <span className="app-toast-icon" aria-hidden="true">{toast.kind === "error" ? "!" : "i"}</span>
      <span>{toast.message}</span>
      <button className="ghost icon-btn" onClick={() => setToast(null)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
