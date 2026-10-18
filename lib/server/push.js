import "server-only";
import webpush from "web-push";

// Sends a notification to someone's devices through Apple's / Google's
// delivery services. The VAPID keys prove the notification comes from this
// app; the private one is a server-only secret.
let configured = false;
function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not set");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", publicKey, privateKey);
  configured = true;
}

// Sends `payload` ({ title, body, url, tag }) to each device. Devices whose
// address no longer works (notifications turned off, app removed) are deleted.
// Returns how many were accepted, and why the others weren't.
export async function sendToDevices(admin, devices, payload) {
  configure();
  let delivered = 0;
  const problems = [];
  for (const device of devices) {
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 }
      );
      delivered++;
    } catch (err) {
      problems.push(err.statusCode ? `${err.statusCode} ${String(err.body || "").trim() || err.message}` : err.message);
      if (err.statusCode === 404 || err.statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", device.endpoint);
      }
    }
  }
  return { delivered, problems };
}
