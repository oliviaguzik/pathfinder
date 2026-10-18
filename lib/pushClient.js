import { supabase } from "./supabaseClient";

// Turning notifications on and off for this device (browser or installed app).

// The public half of the VAPID key pair, as the browser wants it.
function keyBytes(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

// Where this device stands: "dev" (the background script is off while
// developing) | "unsupported" | "install-first" (iPhone: only an app added to
// the Home Screen can get notifications) | "blocked" | "off" | "on".
export async function deviceStatus() {
  if (typeof window === "undefined") return "unsupported";
  if (process.env.NODE_ENV !== "production") return "dev";
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (iOS && !installed) return "install-first";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

// A problem turning notifications on, with a message saying what to do.
export class NotificationSetupError extends Error {}

function within(ms, promise, message) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new NotificationSetupError(message)), ms))]);
}

// Asks permission, gets this device's private address from Apple / Google, and
// saves it so the server can send here. iPhone only shows the permission
// question when it's asked straight from a tap, so it comes first, before
// anything else is awaited. Problems throw NotificationSetupError.
export async function turnOnForDevice() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  if (!publicKey) {
    throw new NotificationSetupError(
      "This version of the app is missing its notification key. In Vercel, check NEXT_PUBLIC_VAPID_PUBLIC_KEY is set, then redeploy."
    );
  }
  const registration = await within(
    10000,
    navigator.serviceWorker.ready,
    "The app's background script isn't running yet. Close PathFinder fully, open it again, and retry."
  );
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    } catch (err) {
      throw new NotificationSetupError(`Apple / Google didn't give this device a notification address (${err.name}: ${err.message}).`);
    }
  }
  const { endpoint, keys } = subscription.toJSON();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  if (error) throw new NotificationSetupError(`Couldn't save this device (${error.message}).`);
  return "on";
}

export async function turnOffForDevice() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return "off";
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
  return "off";
}

// Asks the server to send a test notification to this person's devices.
export async function sendTestNotification() {
  const { data } = await supabase.auth.getSession();
  const response = await fetch("/api/notifications/test", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
  });
  const result = await response.json().catch(() => ({}));
  return response.ok ? { ok: true } : { ok: false, error: result.error || `Couldn't send the test (error ${response.status}).` };
}
