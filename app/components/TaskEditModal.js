"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import TaskFields from "./TaskFields";
import { notifyUndo, notifyWarning } from "../../lib/notify";
import { EMPTY_TASK_FORM, taskFormFromTask } from "../../lib/taskForm";
import { deleteTaskAndSync, restoreTask, saveTaskEdit } from "../../lib/taskActions";

// Edit or delete one task in a dialog. `tasks` and `goals` are the lists as
// loaded (for goal status syncing and the goal picker). `onSaved` runs after
// any save or delete.
export default function TaskEditModal({ task, tasks, goals, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_TASK_FORM);

  useEffect(() => {
    if (!task) return;
    setForm(taskFormFromTask(task));
  }, [task]);

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
