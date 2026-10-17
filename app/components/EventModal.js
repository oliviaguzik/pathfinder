"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import EventFields from "./EventFields";
import { supabase } from "../../lib/supabaseClient";
import { notifyUndo, notifyWarning } from "../../lib/notify";
import { EMPTY_EVENT_FORM, eventFieldsFromForm, eventFormFromEvent, newEventForm } from "../../lib/events";
import { agendaDayLabel } from "../../lib/taskGroups";
import { deleteEvent, restoreEvent, skipOccurrence, unskipOccurrence } from "../../lib/eventActions";

// Add or edit an event. Pass `event` to edit it, or `defaultDate` (YYYY-MM-DD)
// to start a new one on that day. `onSaved` runs after any save or delete.
// A repeating event edits the whole series; deleting offers just this day
// (the one it was opened from) or all of them.
export default function EventModal({ open, event, defaultDate, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_EVENT_FORM);

  useEffect(() => {
    if (!open) return;
    setForm(event ? eventFormFromEvent(event) : newEventForm(defaultDate));
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
    const deleted = event;
    await deleteEvent(deleted);
    onSaved();
    onClose();
    notifyUndo(`Deleted: ${deleted.title}`, async () => {
      await restoreEvent(deleted);
      onSaved();
    });
  }

  async function removeThisOne() {
    const day = event;
    await skipOccurrence(day);
    onSaved();
    onClose();
    notifyUndo(`Deleted: ${day.title} (${agendaDayLabel(day.date)})`, async () => {
      await unskipOccurrence(day);
      onSaved();
    });
  }

  const repeating = !!event?.recurrence_unit;

  return (
    <Modal open={open} onClose={onClose} title={event ? "Edit event" : "New event"}>
      <form className="form-grid event-form" onSubmit={save}>
        <EventFields form={form} onChange={set} idPrefix="event" autoFocus />
        <div className="form-actions">
          {event && !repeating && (
            <button type="button" className="danger" style={{ marginRight: "auto" }} onClick={remove}>
              Delete
            </button>
          )}
          {event && repeating && (
            <span className="event-delete-choices">
              <button type="button" className="danger" onClick={removeThisOne}>
                Delete this one
              </button>
              <button type="button" className="ghost danger-text" onClick={remove}>
                Delete all
              </button>
            </span>
          )}
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary event-primary">{event ? "Save" : "Add event"}</button>
        </div>
      </form>
    </Modal>
  );
}
