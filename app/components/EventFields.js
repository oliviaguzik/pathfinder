"use client";

// The fields shared by every add/edit event form. `form` is shaped like
// EMPTY_EVENT_FORM (lib/events.js); `onChange` receives the changed keys.
// Pass `showTitle={false}` when the caller renders the title input itself.
export default function EventFields({ form, onChange, idPrefix, showTitle = true, showNotes = true, autoFocus = false }) {
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
        <label htmlFor={id("date")}>Date</label>
        <input id={id("date")} type="date" value={form.date} onChange={(e) => onChange({ date: e.target.value })} />
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
