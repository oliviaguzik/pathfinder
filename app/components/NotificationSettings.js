"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import Select from "./Select";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthProvider";
import { NotificationSetupError, deviceStatus, sendTestNotification, turnOffForDevice, turnOnForDevice } from "../../lib/pushClient";

const DEFAULTS = { event_lead_minutes: 15, morning_summary_time: "08:00", overdue_nudge_time: "19:00" };

const LEAD_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "0", label: "At start" },
  { value: "5", label: "5 min before" },
  { value: "10", label: "10 min before" },
  { value: "15", label: "15 min before" },
  { value: "30", label: "30 min before" },
  { value: "60", label: "1 hour before" },
];

const STATUS_TEXT = {
  dev: "Notifications can be turned on in the live app (or the one on your Home Screen), not while developing. The settings below still save.",
  "install-first": "On iPhone, notifications work in the app on your Home Screen. In Safari, tap Share → Add to Home Screen, open PathFinder from there, then come back here.",
  unsupported: "This browser can't show notifications.",
  blocked: "Notifications are blocked for PathFinder. Allow them in your phone or browser settings, then come back here.",
};

// Notification settings: turn them on for this device, and choose what you're
// reminded about. Settings are saved to your account, for every device.
export default function NotificationSettings({ open, onClose }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [testNote, setTestNote] = useState("");
  // What went wrong turning notifications on, shown in the dialog.
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (!open) return;
    setTestNote("");
    setProblem("");
    deviceStatus().then(setStatus);
    supabase
      .from("notification_settings")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettings({
            event_lead_minutes: data.event_lead_minutes,
            morning_summary_time: data.morning_summary_time?.slice(0, 5) ?? null,
            overdue_nudge_time: data.overdue_nudge_time?.slice(0, 5) ?? null,
          });
        }
      });
  }, [open]);

  // Saves straight away, with this device's time zone so times mean your local time.
  async function save(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase.from("notification_settings").upsert({
      user_id: user.id,
      ...next,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updated_at: new Date().toISOString(),
    });
  }

  // Turning on asks permission first (straight from the tap, as iPhone
  // requires), then saves the settings with this device's time zone.
  async function toggleDevice() {
    setBusy(true);
    setProblem("");
    try {
      if (status === "on") setStatus(await turnOffForDevice());
      else {
        const next = await turnOnForDevice();
        setStatus(next);
        if (next === "on") await save({});
      }
    } catch (err) {
      setProblem(err instanceof NotificationSetupError ? err.message : `Something went wrong (${err?.name}: ${err?.message}).`);
    }
    setBusy(false);
  }

  async function test() {
    setTestNote("Sending…");
    const result = await sendTestNotification();
    setTestNote(result.ok ? "Sent. It should appear in a moment." : result.error);
  }

  const timeSetting = (key, label, hint) => (
    <div className="notify-row">
      <label className="notify-check">
        <input
          type="checkbox"
          className="checkbox checkbox-square"
          checked={settings[key] !== null}
          onChange={(e) => save({ [key]: e.target.checked ? DEFAULTS[key] : null })}
        />
        <span>
          {label}
          <span className="notify-hint">{hint}</span>
        </span>
      </label>
      {settings[key] !== null && (
        <input type="time" aria-label={`${label} time`} value={settings[key]} onChange={(e) => e.target.value && save({ [key]: e.target.value })} />
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Notifications">
      <div className="notify-settings">
        <section className="notify-device">
          {STATUS_TEXT[status] ? (
            <p className="notify-status">{STATUS_TEXT[status]}</p>
          ) : (
            <div className="notify-device-row">
              <span>
                <strong>{status === "on" ? "On for this device" : "Off for this device"}</strong>
                <span className="notify-hint">Turn on separately on each phone or computer you use.</span>
              </span>
              <button type="button" className={status === "on" ? "" : "primary"} onClick={toggleDevice} disabled={busy || status === null}>
                {status === "on" ? "Turn off" : "Turn on"}
              </button>
            </div>
          )}
          {problem && <p className="notify-problem">{problem}</p>}
        </section>

        <div className="notify-row">
          <span>
            Before events
            <span className="notify-hint">Each event can choose its own in its Reminder field.</span>
          </span>
          <Select
            ariaLabel="Remind me before events"
            value={settings.event_lead_minutes === null ? "off" : String(settings.event_lead_minutes)}
            onChange={(v) => save({ event_lead_minutes: v === "off" ? null : Number(v) })}
            options={LEAD_OPTIONS}
          />
        </div>
        {timeSetting("morning_summary_time", "Morning summary", "Today's events and tasks, if there are any.")}
        {timeSetting("overdue_nudge_time", "Overdue nudge", "Only when something is overdue.")}
        <p className="notify-hint notify-footnote">Task reminders: set “Remind me” on a task.</p>

        {status === "on" && (
          <div className="notify-test">
            <button type="button" className="ghost small-btn" onClick={test}>
              Send a test notification
            </button>
            {testNote && <span className="notify-hint">{testNote}</span>}
          </div>
        )}
      </div>
    </Modal>
  );
}
