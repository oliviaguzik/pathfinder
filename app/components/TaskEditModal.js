"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import Icon from "./Icon";
import { supabase } from "../../lib/supabaseClient";
import { todayLocalISODate } from "../../lib/dates";
import { FOCUS_LIMIT } from "../../lib/focus";
import TaskFields from "./TaskFields";
import { notifyUndo, notifyWarning } from "../../lib/notify";
import { EMPTY_TASK_FORM, taskFormFromTask } from "../../lib/taskForm";
import { deleteTaskAndSync, restoreTask, saveTaskEdit } from "../../lib/taskActions";

// Edit or delete one task in a dialog. `tasks` and `goals` are the lists as
// loaded (for goal status syncing and the goal picker). `onSaved` runs after
// any save or delete. "Focus today" stars an open task for today's focus
// straight away (from any page), up to FOCUS_LIMIT.
export default function TaskEditModal({ task, tasks, goals, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_TASK_FORM);
  const [inFocus, setInFocus] = useState(false);
  const today = todayLocalISODate();

  useEffect(() => {
    if (!task) return;
    setForm(taskFormFromTask(task));
    setInFocus(task.focus_date === today);
  }, [task]);

  async function toggleFocus() {
    const on = !inFocus;
    if (on) {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("focus_date", today)
        .neq("status", "Done");
      if (count >= FOCUS_LIMIT) return notifyWarning(`Today's focus already has ${FOCUS_LIMIT} tasks. Finish or unstar one first.`);
    }
    setInFocus(on);
    await supabase.from("tasks").update({ focus_date: on ? today : null }).eq("id", task.id);
    onSaved();
  }

  // Finished and paused goals aren't offered, except the task's current one.
  const openGoals = goals.filter((g) => (!g.completed_at && !g.paused_at) || g.id === task?.goal_id);
  const goalOptions = [{ value: "", label: "Select goal…" }, ...openGoals.map((g) => ({ value: g.id, label: g.name }))];

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return notifyWarning("A task needs a name. Type one, or delete the task instead.");
    const { error } = await saveTaskEdit(task, form, { tasks, goals });
    if (error) return; // the app-wide error toast already explains it
    onSaved();
    onClose();
  }

  async function remove() {
    const deleted = task;
    await deleteTaskAndSync(deleted, { tasks, goals });
    onSaved();
    onClose();
    notifyUndo(`Deleted: ${deleted.name}`, async () => {
      await restoreTask(deleted, { tasks, goals });
      onSaved();
    });
  }

  return (
    <Modal open={!!task} onClose={onClose} title="Edit task">
      {task && task.status !== "Done" && (
        <button type="button" className={`focus-toggle ${inFocus ? "on" : ""}`} aria-pressed={inFocus} onClick={toggleFocus}>
          <Icon name={inFocus ? "starFilled" : "star"} size={14} />
          {inFocus ? "In today's focus" : "Focus today"}
        </button>
      )}
      <form className="form-grid" style={{ boxShadow: "none", border: "none", padding: 0, margin: 0 }} onSubmit={save}>
        <TaskFields
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          idPrefix="edit-task"
          autoFocus
          goalOptions={goalOptions}
        />
        <div className="form-actions">
          <button type="button" className="danger" style={{ marginRight: "auto" }} onClick={remove}>
            Delete
          </button>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
