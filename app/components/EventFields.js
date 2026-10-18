"use client";

import Select from "./Select";
import { RECURRENCE_PRESET_OPTIONS } from "../../lib/recurrence";

// "" = the default from Notification settings; -1 = no reminder.
const REMINDER_OPTIONS = [
  { value: "", label: "Default" },
  { value: "-1", label: "None" },
  { value: "0", label: "At start" },
  { value: "5", label: "5 min before" },
  { value: "10", label: "10 min before" },
  { value: "15", label: "15 min before" },
  { value: "30", label: "30 min before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];

// The fields shared by every add/edit event form. `form` is shaped like
// EMPTY_EVENT_FORM (lib/events.js); `onChange` receives the changed keys.
// Pass `showTitle={false}` when the caller renders the title input itself;
// `dateHint` adds a small line under the Date field.
export default function EventFields({ form, onChange, idPrefix, showTitle = true, showNotes = true, autoFocus = false, dateHint }) {
  const id = (suffix) => `${idPrefix}-${suffix}`;

  return (
    <>
      {showTitle && (
        <div className="field field-full">
          <label htmlFor={id("title")}>Event</label>
          <input
            id={id("title")}
            type="text"
            placeholder="e.g. Dentist, Dinner with Sam"
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            autoFocus={autoFocus}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor={id("date")}>{form.repeats ? "First date" : "Date"}</label>
        <input id={id("date")} type="date" value={form.date} onChange={(e) => onChange({ date: e.target.value })} />
        {dateHint && <span className="field-hint">{dateHint}</span>}
      </div>
      <div className="field field-recurring">
        <label htmlFor={id("allday")}>All day</label>
        <input
          id={id("allday")}
          type="checkbox"
          className="checkbox checkbox-square checkbox-event"
          checked={form.allDay}
          onChange={(e) => onChange({ allDay: e.target.checked })}
        />
      </div>
      {!form.allDay && (
        <>
          <div className="field">
            <label htmlFor={id("start")}>Starts</label>
            <input id={id("start")} type="time" value={form.startTime} onChange={(e) => onChange({ startTime: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={id("end")}>Ends</label>
            <input id={id("end")} type="time" value={form.endTime} onChange={(e) => onChange({ endTime: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={id("reminder")}>Reminder</label>
            <Select
              id={id("reminder")}
              value={form.reminderMinutes ?? ""}
              onChange={(reminderMinutes) => onChange({ reminderMinutes })}
              options={REMINDER_OPTIONS}
            />
          </div>
        </>
      )}
      <div className="field field-recurring">
        <label htmlFor={id("recurring")}>Recurring</label>
        <input
          id={id("recurring")}
          type="checkbox"
          className="checkbox checkbox-square checkbox-event"
          checked={!!form.repeats}
          onChange={(e) => onChange({ repeats: e.target.checked })}
        />
      </div>
      {form.repeats && (
        <>
          <div className="field field-repeats">
            <label htmlFor={id("repeats")}>Repeats</label>
            <Select
              id={id("repeats")}
              value={form.recurrencePreset}
              onChange={(recurrencePreset) => onChange({ recurrencePreset })}
              options={RECURRENCE_PRESET_OPTIONS}
            />
          </div>
          {form.recurrencePreset === "custom" && (
            <div className="field">
              <label htmlFor={id("repeats-days")}>Every N days</label>
              <input
                id={id("repeats-days")}
                type="number"
                min="1"
                value={form.recurrenceCustomDays}
                onChange={(e) => onChange({ recurrenceCustomDays: e.target.value })}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor={id("until")}>Until</label>
            <input id={id("until")} type="date" value={form.repeatUntil} min={form.date} onChange={(e) => onChange({ repeatUntil: e.target.value })} />
            <span className="field-hint">Optional</span>
          </div>
        </>
      )}
      <div className={`field ${showNotes ? "field-full" : ""}`}>
        <label htmlFor={id("location")}>Location</label>
        <input
          id={id("location")}
          type="text"
          placeholder="Optional"
          value={form.location}
          onChange={(e) => onChange({ location: e.target.value })}
        />
      </div>
      {showNotes && (
        <div className="field field-full">
          <label htmlFor={id("notes")}>Notes</label>
          <textarea id={id("notes")} rows={2} value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        </div>
      )}
    </>
  );
}
