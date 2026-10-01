"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import EventFields from "./EventFields";
import { supabase } from "../../lib/supabaseClient";
import { notifyWarning } from "../../lib/notify";
import { EMPTY_EVENT_FORM, eventFieldsFromForm, eventFormFromEvent, newEventForm } from "../../lib/events";

// Add or edit an event. Pass `event` to edit it, or `defaultDate` (YYYY-MM-DD)
// to start a new one on that day. `onSaved` runs after any save or delete.
export default function EventModal({ open, event, defaultDate, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_EVENT_FORM);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(event ? eventFormFromEvent(event) : newEventForm(defaultDate));
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
        <EventFields form={form} onChange={set} idPrefix="event" autoFocus />
        <div className="form-actions">
          {event && (
            <button type="button" className="danger" style={{ marginRight: "auto" }} onClick={remove}>
              {confirmingDelete ? "Click again to delete" : "Delete"}
            </button>
          )}
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary event-primary">{event ? "Save" : "Add event"}</button>
        </div>
      </form>
    </Modal>
  );
}
