import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/server/supabaseAdmin";
import { sendToDevices } from "../../../../lib/server/push";

export const dynamic = "force-dynamic";

// "Send a test notification" from the settings: the signed-in person's own
// sign-in token proves who they are, and it only ever goes to their devices.
export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: devices } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", data.user.id);
  if (!devices?.length) return NextResponse.json({ error: "Notifications aren't on for any device yet" }, { status: 400 });
  let result;
  try {
    result = await sendToDevices(admin, devices, {
      title: "Notifications are on",
      body: "PathFinder will remind you about events and tasks here.",
      url: "/",
      tag: "test",
    });
  } catch (err) {
    return NextResponse.json({ error: `Couldn't send (${err.message}).` }, { status: 500 });
  }
  // Apple / Google turned every device down: say why, so it can be fixed.
  if (!result.delivered) {
    return NextResponse.json({ error: `Apple / Google didn't accept it (${result.problems.join("; ")}).` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, delivered: result.delivered });
}
