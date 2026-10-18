"use client";

import { useState } from "react";
import Modal from "./Modal";
import Icon from "./Icon";
import { FOCUS_LIMIT, focusCandidates } from "../../lib/focus";
import { friendlyDate } from "../../lib/dates";

// "Pick today's focus": suggestions first (main goal's next step, overdue, due
// today, high priority), then every other open task, dated or not, with a
// search to narrow it all. Tapping a row stars it straight away.
export default function FocusPicker({ open, onClose, tasks, today, nextStepId, pausedGoalIds, focusCount, onPick }) {
  const [query, setQuery] = useState("");
  const { sections, rest } = focusCandidates(tasks, { today, nextStepId, pausedGoalIds });
  const full = focusCount >= FOCUS_LIMIT;
  const q = query.trim().toLowerCase();
  // Suggestions first, then every other open task; the search narrows it all.
  const all = [...sections, ...(rest.length ? [{ title: sections.length ? "All other tasks" : "Your tasks", tasks: rest }] : [])];
  const shown = q
    ? [{ title: "Matching tasks", tasks: all.flatMap((s) => s.tasks).filter((t) => t.name.toLowerCase().includes(q)) }]
    : all;

  function close() {
    setQuery("");
    onClose();
  }

  const row = (t) => (
    <button key={t.id} type="button" className="focus-pick-row" onClick={() => onPick(t)} disabled={full}>
      <Icon name="star" size={16} />
      <span className="focus-pick-name">{t.name}</span>
      {t.due_date && <span className={`focus-pick-due ${t.due_date < today ? "overdue" : ""}`}>{friendlyDate(t.due_date)}</span>}
    </button>
  );

  return (
    <Modal open={open} onClose={close} title="Today's focus">
      <p className="focus-pick-intro">
        {full
          ? `That's ${FOCUS_LIMIT}. A short list gets done; the rest of today is a bonus.`
          : `Pick up to ${FOCUS_LIMIT} tasks that would make today a win (${focusCount} of ${FOCUS_LIMIT} picked).`}
      </p>
      <input
        type="text"
        className="focus-pick-search"
        placeholder="Search your tasks"
        aria-label="Search your tasks"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {shown.map((s) => (
        <section key={s.title} className="focus-pick-section">
          <h3 className="focus-pick-title">{s.title}</h3>
          {s.tasks.length ? s.tasks.map(row) : <p className="focus-pick-empty">No tasks match.</p>}
        </section>
      ))}
      {!q && !all.length && <p className="focus-pick-empty">No open tasks to pick from. Add one first.</p>}
      <div className="form-actions">
        <button type="button" className="primary" onClick={close}>
          Done
        </button>
      </div>
    </Modal>
  );
}
