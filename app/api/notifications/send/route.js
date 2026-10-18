import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/server/supabaseAdmin";
import { sendToDevices } from "../../../../lib/server/push";
import { dueNotifications } from "../../../../lib/notifications";

export const dynamic = "force-dynamic";

// Only the scheduler may run this: it sends "Authorization: Bearer <CRON_SECRET>".
function allowed(request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  return !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Runs every minute (Supabase's scheduler calls it): for each person with
// notifications on, works out what's due (lib/notifications.js) and sends it.
// Each notification is logged first, so it can't go out twice.
export async function POST(request) {
  if (!allowed(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const admin = supabaseAdmin();
  const now = new Date();

  const [{ data: settingsRows }, { data: devices }] = await Promise.all([
    admin.from("notification_settings").select("*"),
    admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth"),
  ]);
  const devicesByUser = {};
  for (const d of devices || []) (devicesByUser[d.user_id] ||= []).push(d);

  let sent = 0;
  for (const settings of settingsRows || []) {
    const userDevices = devicesByUser[settings.user_id];
    if (!userDevices?.length) continue;
    const since = new Date(now.getTime() - 3 * 86400000).toISOString();
    const [{ data: events }, { data: tasks }, { data: log }] = await Promise.all([
      admin.from("events").select("*").eq("user_id", settings.user_id),
      admin.from("tasks").select("id, name, status, due_date, remind_at").eq("user_id", settings.user_id).neq("status", "Done"),
      admin.from("sent_notifications").select("kind, ref").eq("user_id", settings.user_id).gte("sent_at", since),
    ]);
    const due = dueNotifications({
      now,
      timeZone: settings.time_zone || "UTC",
      settings,
      events: events || [],
      tasks: tasks || [],
      sent: new Set((log || []).map((r) => `${r.kind}:${r.ref}`)),
    });
    for (const n of due) {
      // Claim it first; if another run already did, skip.
      const { data: claimed } = await admin
        .from("sent_notifications")
        .upsert({ user_id: settings.user_id, kind: n.kind, ref: n.ref }, { onConflict: "user_id,kind,ref", ignoreDuplicates: true })
        .select();
      if (!claimed?.length) continue;
      sent += (await sendToDevices(admin, userDevices, { title: n.title, body: n.body, url: n.url, tag: `${n.kind}:${n.ref}` })).delivered;
    }
  }
  return NextResponse.json({ ok: true, sent });
}
