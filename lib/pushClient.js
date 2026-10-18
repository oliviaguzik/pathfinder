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

// Asks permission (must follow a tap), gets this device's private address from
// Apple / Google, and saves it so the server can send here.
export async function turnOnForDevice() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    }));
  const { endpoint, keys } = subscription.toJSON();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  return error ? "off" : "on";
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
  return response.ok ? { ok: true } : { ok: false, error: result.error || "Couldn't send the test." };
}
