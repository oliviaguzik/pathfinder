"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { supabase } from "../../lib/supabaseClient";
import { notifyWarning } from "../../lib/notify";
import { EMPTY_EVENT_FORM, eventFieldsFromForm, eventFormFromEvent } from "../../lib/events";

// Add or edit an event. Pass `event` to edit it, or `defaultDate` (YYYY-MM-DD)
// to start a new one on that day. `onSaved` runs after any save or delete.
export default function EventModal({ open, event, defaultDate, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_EVENT_FORM);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(event ? eventFormFromEvent(event) : { ...EMPTY_EVENT_FORM, date: defaultDate || "" });
    setConfirmingDelete(false);
  }, [open, event, defaultDate]);

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function save(e) {
    e.preventDefault();
    const { fields, error } = eventFieldsFromForm(form);
    if (error) return notifyWarning(error);
    const { error: saveError } = event
      ? await supabase.from("events").update(fields).eq("id", event.id)
      : await supabase.from("events").insert(fields);
    if (saveError) return; // the app-wide error toast already explains it
    onSaved();
    onClose();
  }

  async function remove() {
    if (!confirmingDelete) return setConfirmingDelete(true);
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) return;
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={event ? "Edit event" : "New event"}>
      <form className="form-grid event-form" onSubmit={save}>
        <div className="field field-full">
          <label htmlFor="event-title">Event</label>
          <input
            id="event-title"
            type="text"
            placeholder="e.g. Dentist, Dinner with Sam"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="event-date">Date</label>
          <input id="event-date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div className="field field-recurring">
          <label htmlFor="event-allday">All day</label>
          <input
            id="event-allday"
            type="checkbox"
            className="checkbox checkbox-square"
            checked={form.allDay}
            onChange={(e) => set({ allDay: e.target.checked })}
          />
        </div>
        {!form.allDay && (
          <>
            <div className="field">
              <label htmlFor="event-start">Starts</label>
              <input id="event-start" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="event-end">Ends</label>
              <input id="event-end" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
            </div>
          </>
        )}
        <div className="field field-full">
          <label htmlFor="event-location">Location</label>
          <input
            id="event-location"
            type="text"
            placeholder="Optional"
            value={form.location}
            onChange={(e) => set({ location: e.target.value })}
          />
        </div>
        <div className="field field-full">
          <label htmlFor="event-notes">Notes</label>
          <textarea id="event-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
        <div className="form-actions">
          {event && (
            <button type="button" className="danger" style={{ marginRight: "auto" }} onClick={remove}>
              {confirmingDelete ? "Click again to delete" : "Delete"}
            </button>
          )}
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">{event ? "Save" : "Add event"}</button>
        </div>
      </form>
    </Modal>
  );
}
