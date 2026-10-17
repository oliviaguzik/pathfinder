"use client";

import { useState } from "react";
import Icon from "./Icon";
import HighlightInput from "./HighlightInput";
import { parseQuickAdd } from "../../lib/parseQuickAdd";
import { agendaDayLabel } from "../../lib/taskGroups";

// A one-line "Add a task…" box. Dates typed in plain words ("Call bank fri")
// are read like in the Plan Add bar, shown under the box, and can be ignored
// with ×. `onAdd({ name, dueDate })` saves; Escape (or `onCancel`) closes.
export default function QuickAddTask({ onAdd, onCancel, placeholder = "Add a task…", autoFocus = false }) {
  const [text, setText] = useState("");
  const [ignored, setIgnored] = useState("");
  const found = parseQuickAdd(text);
  const parsed = found.date && found.phrase !== ignored ? found : null;

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await onAdd({ name: parsed ? parsed.title : text.trim(), dueDate: parsed?.date || "" });
    setText("");
    setIgnored("");
  }

  return (
    <form className="quick-add-task" onSubmit={submit}>
      <div className="quick-add-task-row">
        <HighlightInput
          className="quick-add-task-input"
          highlights={parsed ? found.phrases : []}
          type="text"
          value={text}
          placeholder={placeholder}
          aria-label="New task name"
          autoFocus={autoFocus}
          onChange={(e) => {
            if (!e.target.value) setIgnored("");
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && onCancel) onCancel();
          }}
        />
        <button type="submit" className="primary" disabled={!text.trim()}>Add</button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>Done</button>
        )}
      </div>
      {parsed && (
        <div className="quick-add-parsed" role="status">
          <Icon name="calendar" size={13} />
          <span className="quick-add-parsed-when">Due {agendaDayLabel(parsed.date)}</span>
          <button
            type="button"
            className="ghost icon-btn quick-add-parsed-ignore"
            onClick={() => setIgnored(parsed.phrase)}
            aria-label={`Don't read “${parsed.phrase}” as a date`}
            title="Keep these words in the name instead"
          >
            ×
          </button>
        </div>
      )}
    </form>
  );
}
