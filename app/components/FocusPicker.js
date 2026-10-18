"use client";

import { useState } from "react";
import Modal from "./Modal";
import Icon from "./Icon";
import { FOCUS_LIMIT, focusCandidates } from "../../lib/focus";
import { friendlyDate } from "../../lib/dates";

// "Pick today's focus": one scrolling list of every open task, the main goal's
// first, then everything else (most urgent first in each), with a search to
// narrow it. Tapping a row stars it straight away.
export default function FocusPicker({ open, onClose, tasks, today, mainGoal, pausedGoalIds, focusCount, onPick }) {
  const [query, setQuery] = useState("");
  const { forGoal, rest } = focusCandidates(tasks, { today, mainGoalId: mainGoal?.id, pausedGoalIds });
  const full = focusCount >= FOCUS_LIMIT;
  const q = query.trim().toLowerCase();
  const matches = (t) => !q || t.name.toLowerCase().includes(q);
  const groups = [
    { title: mainGoal ? `For your main goal · ${mainGoal.name}` : "", tasks: forGoal.filter(matches) },
    { title: forGoal.length ? "Everything else" : "", tasks: rest.filter(matches) },
  ].filter((g) => g.tasks.length);

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
      <div className="focus-pick-list">
        {groups.map((g) => (
          <section key={g.title || "all"} className="focus-pick-section">
            {g.title && <h3 className="focus-pick-title">{g.title}</h3>}
            {g.tasks.map(row)}
          </section>
        ))}
        {!groups.length && (
          <p className="focus-pick-empty">{q ? "No tasks match." : "No open tasks to pick from. Add one first."}</p>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="primary" onClick={close}>
          Done
        </button>
      </div>
    </Modal>
  );
}
