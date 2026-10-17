"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import CircularProgress from "../components/CircularProgress";
import Modal from "../components/Modal";
import Celebration from "../components/Celebration";
import Skeleton from "../components/Skeleton";
import Icon from "../components/Icon";
import TaskFields from "../components/TaskFields";
import TaskEditModal from "../components/TaskEditModal";
import TaskMeta from "../components/TaskMeta";
import Menu from "../components/Menu";
import { deleteTaskAndSync, restoreTask, toggleTaskDone, undoTaskDone } from "../../lib/taskActions";
import { goalStatusFor, isGoalFullyDone } from "../../lib/goalCompletion";
import { positionBetween, nextPosition, sortByPosition } from "../../lib/reorder";
import { parseLocalDate, toISODateLocal, todayLocalISODate } from "../../lib/dates";
import { EMPTY_TASK_FORM, taskFieldsFromForm } from "../../lib/taskForm";
import { openOnKey, openOnRowClick } from "../../lib/rowClick";
import { useAuth } from "../../lib/AuthProvider";
import { notifyUndo, notifyWarning } from "../../lib/notify";

const FINISHED_PAGE = 3;
// More active goals than this and a gentle nudge suggests pausing some.
const ACTIVE_GOAL_NUDGE = 5;

// Star a goal to make it your main goal (one at a time). Gold, not the
// indigo used for today's focus stars, so the two never blur.
function MainGoalToggle({ isMain, onToggle }) {
  const label = isMain ? "Main goal (click to unstar)" : "Make this your main goal";
  return (
    <button
      type="button"
      className={`ghost icon-btn main-goal-toggle ${isMain ? "on" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={isMain}
      aria-label={label}
      title={label}
    >
      <Icon name={isMain ? "starFilled" : "star"} size={17} />
    </button>
  );
}

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Each change bumps this, so a refresh that started before the change can't
  // land afterwards and put back what was just changed.
  const dataVersion = useRef(0);


  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const [view, setView] = useState("grid");
  const [listExpanded, setListExpanded] = useState({});

  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const [addTaskForId, setAddTaskForId] = useState(null);
  const [newTask, setNewTask] = useState(EMPTY_TASK_FORM);

  // The task open in the edit dialog (the same dialog as on Today and Plan).
  const [editingTask, setEditingTask] = useState(null);

  const [draggedGoalId, setDraggedGoalId] = useState(null);
  const [dragOverGoalId, setDragOverGoalId] = useState(null);

  const [celebration, setCelebration] = useState({ key: 0, message: "" });
  const [celebratingGoalId, setCelebratingGoalId] = useState(null);
  // Finished goals are shown by default; hiding them is remembered.
  const [showFinished, setShowFinished] = useState(true);
  const [finishedLimit, setFinishedLimit] = useState(FINISHED_PAGE);
  // Paused goals start collapsed (they're set aside on purpose); opening is remembered.
  const [showPaused, setShowPaused] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("goalsView");
    if (stored === "grid" || stored === "list") setView(stored);
    if (localStorage.getItem("showFinishedGoals") === "false") setShowFinished(false);
    if (localStorage.getItem("showPausedGoals") === "true") setShowPaused(true);
  }, []);

  function togglePaused() {
    setShowPaused((open) => {
      localStorage.setItem("showPausedGoals", String(!open));
      return !open;
    });
  }

  function toggleFinished() {
    setShowFinished((open) => {
      localStorage.setItem("showFinishedGoals", String(!open));
      return !open;
    });
  }

  function changeView(next) {
    setView(next);
    localStorage.setItem("goalsView", next);
  }

  // Only the first load shows placeholders; later refreshes swap data in quietly.
  async function loadData() {
    const version = ++dataVersion.current;
    const [{ data: goalData }, { data: taskData }] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*"),
    ]);
    if (version !== dataVersion.current) return;
    setGoals(goalData || []);
    setTasks(taskData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addGoal(e) {
    e.preventDefault();
    if (!name.trim()) return notifyWarning("Give the goal a name first.");
    await supabase.from("goals").insert({
      name,
      target_date: targetDate || null,
      notes: notes.trim() || null,
      start_date: todayLocalISODate(),
      status: "Not Started",
      position: nextPosition(goals),
      user_id: user.id,
    });
    setName("");
    setTargetDate("");
    setNotes("");
    setAddOpen(false);
    loadData();
  }

  function toggleListExpand(goalId) {
    setListExpanded((prev) => ({ ...prev, [goalId]: !prev[goalId] }));
  }

  function startEditGoal(goal) {
    setEditingGoalId(goal.id);
    setEditName(goal.name);
    setEditTargetDate(goal.target_date || "");
    setEditNotes(goal.notes || "");
  }

  function cancelEditGoal() {
    setEditingGoalId(null);
  }

  async function saveEditGoal(id) {
    if (!editName.trim()) return notifyWarning("A goal needs a name.");
    await supabase.from("goals").update({
      name: editName,
      target_date: editTargetDate || null,
      notes: editNotes.trim() || null,
    }).eq("id", id);
    setEditingGoalId(null);
    loadData();
  }

  async function reorderGoal(draggedId, targetId, placeAfter) {
    if (!draggedId || draggedId === targetId) return;
    const ordered = sortedGoals.filter((g) => g.id !== draggedId);
    const targetIndex = ordered.findIndex((g) => g.id === targetId);
    if (targetIndex === -1) return;
    const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
    const prev = ordered[insertIndex - 1];
    const next = ordered[insertIndex];
    const newPosition = positionBetween(prev?.position, next?.position);
    await supabase.from("goals").update({ position: newPosition }).eq("id", draggedId);
    loadData();
  }

  async function deleteGoal(id, mode) {
    if (mode === "cascade") {
      await supabase.from("tasks").delete().eq("goal_id", id);
    }
    // mode === "unlink": the goal_id foreign key is ON DELETE SET NULL,
    // so deleting the goal alone unlinks its tasks automatically.
    await supabase.from("goals").delete().eq("id", id);
    setConfirmingDeleteId(null);
    loadData();
  }

  function toggleAddTaskFor(goalId) {
    setAddTaskForId((prev) => (prev === goalId ? null : goalId));
    setNewTask(EMPTY_TASK_FORM);
  }

  async function addTaskToGoal(e, goalId) {
    e.preventDefault();
    if (!newTask.name.trim()) return notifyWarning("Give the task a name first.");
    await supabase.from("tasks").insert({
      ...taskFieldsFromForm(newTask),
      category: "Goal-Related",
      goal_id: goalId,
      status: "To Do",
      user_id: user.id,
    });
    setAddTaskForId(null);
    loadData();
  }

  // Changes show on screen first, then save; the reload afterwards brings in
  // anything the server added (or undoes the change if the save failed).
  function patchTask(id, patch) {
    dataVersion.current++;
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function toggleDone(task) {
    const done = task.status !== "Done";
    patchTask(task.id, { status: done ? "Done" : "To Do", completed_at: done ? new Date().toISOString() : null });
    const saving = toggleTaskDone(task, { tasks, goals, userId: user.id });
    if (done) {
      notifyUndo(`Done: ${task.name}`, async () => {
        patchTask(task.id, { status: "To Do", completed_at: null });
        await undoTaskDone(task, await saving, { tasks, goals, userId: user.id });
        loadData();
      });
    }
    await saving;
    loadData();
  }

  async function moveTaskToDate(task, date) {
    patchTask(task.id, { due_date: date });
    await supabase.from("tasks").update({ due_date: date }).eq("id", task.id);
    loadData();
  }

  async function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    dataVersion.current++;
    setTasks((list) => list.filter((t) => t.id !== id));
    // The note shows right away; Undo waits for the delete to finish first.
    const deleting = deleteTaskAndSync(task, { tasks, goals });
    notifyUndo(`Deleted: ${task.name}`, async () => {
      dataVersion.current++;
      setTasks((list) => [...list, task]);
      await deleting;
      await restoreTask(task, { tasks, goals });
      loadData();
    });
    await deleting;
    loadData();
  }

  async function finishGoal(goal) {
    const count = tasksFor(goal.id).length;

    await supabase
      .from("goals")
      // A finished goal stops being the main goal; you pick the next one.
      .update({ completed_at: new Date().toISOString(), status: "Completed", is_main: false })
      .eq("id", goal.id);
    setCelebration({
      key: Date.now(),
      message: `🎉 "${goal.name}" complete!`,
      subtitle: `${count} task${count === 1 ? "" : "s"} done. Nice work.`,
    });
    setCelebratingGoalId(goal.id);
    setTimeout(() => setCelebratingGoalId((current) => (current === goal.id ? null : current)), 1200);
    loadData();
  }

  async function reopenGoal(goal) {
    await supabase
      .from("goals")
      .update({ completed_at: null, status: goalStatusFor({ ...goal, completed_at: null }, tasksFor(goal.id)) })
      .eq("id", goal.id);
    loadData();
  }

  // Only one main goal at a time (enforced by a unique index), so clear the
  // current one before setting the new one.
  async function setMainGoal(goal, on) {
    if (on) {
      await supabase.from("goals").update({ is_main: false }).eq("is_main", true);
    }
    await supabase.from("goals").update({ is_main: on }).eq("id", goal.id);
    loadData();
  }

  // Pausing sets a goal aside without finishing it; a paused goal can't be the
  // main goal. Resuming brings it back exactly as it was.
  async function setPaused(goal, paused) {
    await supabase
      .from("goals")
      .update(paused ? { paused_at: new Date().toISOString(), is_main: false } : { paused_at: null })
      .eq("id", goal.id);
    loadData();
  }

  function tasksFor(goalId) {
    return tasks.filter((t) => t.goal_id === goalId);
  }

  function sortByDueDateOnly(list) {
    return [...list].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }

  // Completed tasks always sink to the bottom, regardless of due date.
  function sortByDueDate(list) {
    const notDone = list.filter((t) => t.status !== "Done");
    const done = list.filter((t) => t.status === "Done");
    return [...sortByDueDateOnly(notDone), ...sortByDueDateOnly(done)];
  }

  function targetLine(goal) {
    if (!goal.target_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = parseLocalDate(goal.target_date);
    const diffDays = Math.round((target - today) / 86400000);
    const dateStr = target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (diffDays > 0) return `Target: ${dateStr} · ${diffDays} day${diffDays === 1 ? "" : "s"} left`;
    if (diffDays === 0) return `Target: ${dateStr} · due today`;
    return `Target: ${dateStr} · ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`;
  }

  function pausedLabel(goal) {
    const since = new Date(goal.paused_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { text: `Paused since ${since}`, cls: "badge-low" };
  }

  function paceLabel(goal, goalTasks) {
    const total = goalTasks.length;
    const doneCount = goalTasks.filter((t) => t.status === "Done").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = goal.target_date ? parseLocalDate(goal.target_date) : null;
    const isPastDue = target && today > target;

    if (total === 0) {
      return isPastDue ? { text: "Past due", cls: "badge-high" } : null;
    }
    if (goal.completed_at) {
      const completedDate = new Date(goal.completed_at);
      const completedText = `Completed ${completedDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(completedDate.getFullYear() !== today.getFullYear() && { year: "numeric" }),
      })}`;
      return { text: completedText, cls: "badge-success" };
    }
    if (doneCount === total) {
      return { text: "Ready to finish", cls: "badge-success" };
    }
    if (isPastDue) {
      return { text: "Past due", cls: "badge-high" };
    }
    if (doneCount === 0) {
      return { text: "Not started yet", cls: "badge-low" };
    }
    if (!target) {
      return null;
    }

    const hasOverdueTask = goalTasks.some(
      (t) => t.status !== "Done" && t.due_date && parseLocalDate(t.due_date) < today
    );
    if (hasOverdueTask) return { text: "Behind pace", cls: "badge-high" };

    const start = goal.start_date ? parseLocalDate(goal.start_date) : new Date(goal.created_at);
    const totalDays = (target - start) / 86400000;
    const elapsedDays = (today - start) / 86400000;
    const timePct = totalDays > 0 ? elapsedDays / totalDays : 1;
    const donePct = doneCount / total;
    return donePct >= timePct
      ? { text: "On track", cls: "badge-success" }
      : { text: "Behind pace", cls: "badge-high" };
  }

  function renderAddTaskForm(goalId) {
    return (
      <form className="form-grid" onSubmit={(e) => addTaskToGoal(e, goalId)}>
        <TaskFields
          form={newTask}
          onChange={(patch) => setNewTask((f) => ({ ...f, ...patch }))}
          idPrefix="goal-task"
          namePlaceholder="e.g. Practice verbs"
          autoFocus
        />
        <div className="form-actions">
          <button type="submit" className="primary">Add task</button>
          <button type="button" onClick={() => toggleAddTaskFor(goalId)}>Cancel</button>
        </div>
      </form>
    );
  }

  function renderTaskRow(t, locked = false) {
    return (
      <div
        className={`task-row ${locked ? "" : "clickable-row"}`}
        key={t.id}
        onClick={locked ? undefined : openOnRowClick(() => setEditingTask(t))}
      >
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          disabled={locked}
          onChange={() => toggleDone(t)}
          aria-label={`Mark "${t.name}" ${t.status === "Done" ? "not done" : "done"}`}
        />
        <span
          className={`task-name ${t.status === "Done" ? "done" : ""}`}
          {...(locked ? {} : { role: "button", tabIndex: 0, onKeyDown: openOnKey(() => setEditingTask(t)) })}
        >
          {t.name}
        </span>
        <TaskMeta task={t} compact onReschedule={locked ? undefined : (date) => moveTaskToDate(t, date)} />
        {!locked && (
          <button className="ghost row-delete-btn" onClick={() => deleteTask(t.id)} aria-label="Delete task" title="Delete">
            ×
          </button>
        )}
      </div>
    );
  }

  // Finishing is deliberate: once every task is done the badge reads
  // "Ready to finish" and this button appears at the end of the progress row.
  function renderFinishButton(g, goalTasks) {
    if (g.completed_at || g.paused_at || !isGoalFullyDone(goalTasks)) return null;
    return (
      <button
        type="button"
        className="primary finish-goal-btn"
        onClick={(e) => {
          e.stopPropagation();
          finishGoal(g);
        }}
      >
        <Icon name="check" size={14} />
        Finish goal
      </button>
    );
  }

  function renderGoalBody(g, goalTasks, pace, pct, doneCount, { showHeader = true } = {}) {
    if (editingGoalId === g.id) {
      return (
        <div className="form-grid compact" style={{ marginBottom: 0 }}>
          <div className="field field-full">
            <label>Goal name</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
          </div>
          <div className="field field-full">
            <label>Target date</label>
            <input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} />
          </div>
          <div className="field field-full">
            <label>Notes</label>
            <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
          <div className="form-actions">
            <button className="primary" onClick={() => saveEditGoal(g.id)}>Save</button>
            <button onClick={cancelEditGoal}>Cancel</button>
          </div>
        </div>
      );
    }

    const addingHere = addTaskForId === g.id;
    const isFinished = !!g.completed_at;
    const isPaused = !isFinished && !!g.paused_at;
    // Finished and paused goals are read-only until reopened / resumed.
    const locked = isFinished || isPaused;
    const menu = (
      <Menu
        label={`Actions for ${g.name}`}
        items={[
          ...(isFinished
            ? [{ label: "Reopen goal", onClick: () => reopenGoal(g) }]
            : isPaused
              ? [
                  { label: "Resume goal", onClick: () => setPaused(g, false) },
                  { label: "Edit goal", onClick: () => startEditGoal(g) },
                ]
              : [
                  { label: "Edit goal", onClick: () => startEditGoal(g) },
                  { label: "Pause goal", onClick: () => setPaused(g, true) },
                ]),
          { label: "Delete goal", danger: true, onClick: () => setConfirmingDeleteId(g.id) },
        ]}
      />
    );

    return (
      <>
        {showHeader && (
          <>
            {g.is_main && !isFinished && (
              <p className="main-goal-caption">
                <Icon name="starFilled" size={12} />
                <span>
                  <strong>Main goal</strong> · Give it your best energy. The others can wait their turn.
                </span>
              </p>
            )}
            <div className="row-between" style={{ alignItems: "flex-start" }}>
              <span className="goal-tile-name">{g.name}</span>
              <div className="goal-card-actions">
                {!locked && <MainGoalToggle isMain={!!g.is_main} onToggle={() => setMainGoal(g, !g.is_main)} />}
                {menu}
              </div>
            </div>
            {g.target_date && <div className="muted" style={{ marginTop: 2 }}>{targetLine(g)}</div>}
            <div className="goal-progress-row">
              <CircularProgress percent={pct} size={48} strokeWidth={5} />
              <div className="goal-progress-text">
                {pace && <span className={`badge ${pace.cls}`}>{pace.text}</span>}
                <span className="muted">{doneCount} / {goalTasks.length} tasks done</span>
              </div>
              {renderFinishButton(g, goalTasks)}
            </div>
          </>
        )}

        {g.notes && <p className="goal-notes" style={{ marginTop: showHeader ? 10 : 0 }}>{g.notes}</p>}

        {!showHeader && (
          <div className="row" style={{ justifyContent: "flex-end", marginTop: g.notes ? 6 : -4 }}>
            {menu}
          </div>
        )}

        {confirmingDeleteId === g.id && (
          <div className="confirm-delete">
            <span className="muted">
              {goalTasks.length > 0
                ? `Delete "${g.name}"? It has ${goalTasks.length} linked task${goalTasks.length === 1 ? "" : "s"}.`
                : `Delete "${g.name}"?`}
            </span>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {goalTasks.length > 0 ? (
                <>
                  <button onClick={() => deleteGoal(g.id, "unlink")}>Keep tasks (unlink)</button>
                  <button className="danger" onClick={() => deleteGoal(g.id, "cascade")}>Delete tasks too</button>
                </>
              ) : (
                <button className="danger" onClick={() => deleteGoal(g.id, "unlink")}>Confirm delete</button>
              )}
              <button className="ghost" onClick={() => setConfirmingDeleteId(null)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="tile-tasks-box">
          <div className="tile-tasks-header">
            <span>Tasks</span>
            {!addingHere && !locked && (
              <button className="ghost" onClick={() => toggleAddTaskFor(g.id)}>+ Add task</button>
            )}
          </div>

          {addingHere && !locked && <div className="tile-add-task-form">{renderAddTaskForm(g.id)}</div>}

          <div className="tile-tasks-list">
            {goalTasks.length === 0 && <p className="muted">No tasks linked yet.</p>}
            {goalTasks.map((t) => renderTaskRow(t, locked))}
          </div>
        </div>
      </>
    );
  }

  // Manual drag order first, then finished goals sink to the bottom
  // (stable sort preserves relative order within each group). A goal with
  // all tasks done but not yet explicitly finished stays in place, since
  // finishing is a deliberate action, not an automatic side effect.
  const sortedGoals = sortByPosition(goals).sort((a, b) => {
    const aDone = !!a.completed_at;
    const bDone = !!b.completed_at;
    if (aDone !== bDone) return aDone ? 1 : -1;
    // The main goal leads the active goals.
    return Number(!!b.is_main && !bDone) - Number(!!a.is_main && !aDone);
  });
  const activeGoals = sortedGoals.filter((g) => !g.completed_at && !g.paused_at);
  const pausedGoals = sortedGoals.filter((g) => !g.completed_at && g.paused_at);
  // Most recently finished first, a few at a time.
  const finishedGoals = sortedGoals
    .filter((g) => g.completed_at)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const finishedHidden = Math.max(0, finishedGoals.length - finishedLimit);

  function renderGoalCollection(list) {
    if (list.length === 0) return null;
    return (
      view === "grid" ? (
        <div className="goal-grid">
          {list.map((g) => {
            const goalTasks = sortByDueDate(tasksFor(g.id));
            const doneCount = goalTasks.filter((t) => t.status === "Done").length;
            const pct = goalTasks.length > 0 ? Math.round((doneCount / goalTasks.length) * 100) : 0;
            const pace = g.paused_at && !g.completed_at ? pausedLabel(g) : paceLabel(g, goalTasks);

            return (
              <div
                className={`card goal-tile-full ${g.is_main && !g.completed_at ? "is-main" : ""} ${dragOverGoalId === g.id ? "drag-over" : ""} ${celebratingGoalId === g.id ? "celebrating" : ""}`}
                key={g.id}
                onDragOver={(e) => {
                  if (!draggedGoalId) return;
                  e.preventDefault();
                  setDragOverGoalId(g.id);
                }}
                onDragLeave={() => setDragOverGoalId((id) => (id === g.id ? null : id))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverGoalId(null);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const placeAfter = e.clientY > rect.top + rect.height / 2;
                  reorderGoal(draggedGoalId, g.id, placeAfter);
                  setDraggedGoalId(null);
                }}
              >
                <div
                  className="drag-handle goal-drag-handle"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDraggedGoalId(g.id);
                  }}
                  onDragEnd={() => {
                    setDraggedGoalId(null);
                    setDragOverGoalId(null);
                  }}
                  title="Drag to reorder"
                  aria-label="Drag to reorder"
                >
                  <Icon name="dragHandle" size={13} />
                </div>
                {renderGoalBody(g, goalTasks, pace, pct, doneCount)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="goal-list">
          {list.map((g) => {
            const goalTasks = sortByDueDate(tasksFor(g.id));
            const doneCount = goalTasks.filter((t) => t.status === "Done").length;
            const pct = goalTasks.length > 0 ? Math.round((doneCount / goalTasks.length) * 100) : 0;
            const pace = g.paused_at && !g.completed_at ? pausedLabel(g) : paceLabel(g, goalTasks);
            const isOpen = listExpanded[g.id];

            return (
              <div
                className={`card goal-list-row-full ${g.is_main && !g.completed_at ? "is-main" : ""} ${dragOverGoalId === g.id ? "drag-over" : ""} ${celebratingGoalId === g.id ? "celebrating" : ""}`}
                key={g.id}
                onDragOver={(e) => {
                  if (!draggedGoalId) return;
                  e.preventDefault();
                  setDragOverGoalId(g.id);
                }}
                onDragLeave={() => setDragOverGoalId((id) => (id === g.id ? null : id))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverGoalId(null);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const placeAfter = e.clientY > rect.top + rect.height / 2;
                  reorderGoal(draggedGoalId, g.id, placeAfter);
                  setDraggedGoalId(null);
                }}
              >
                <div
                  className="goal-list-row-summary"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleListExpand(g.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleListExpand(g.id);
                    }
                  }}
                >
                  <div
                    className="drag-handle goal-drag-handle"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDraggedGoalId(g.id);
                    }}
                    onDragEnd={() => {
                      setDraggedGoalId(null);
                      setDragOverGoalId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                  >
                    <Icon name="dragHandle" size={13} />
                  </div>
                  <CircularProgress percent={pct} size={40} strokeWidth={4} />
                  <div className="goal-list-row-info">
                    <div className="goal-list-row-top">
                      <span className="goal-tile-name">{g.name}</span>
                      {pace && <span className={`badge ${pace.cls}`}>{pace.text}</span>}
                    </div>
                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      {g.is_main && !g.completed_at && (
                        <span className="main-goal-inline">
                          <Icon name="starFilled" size={12} /> Main goal
                        </span>
                      )}
                      {g.target_date && <span className="muted">{targetLine(g)}</span>}
                      <span className="muted">{doneCount} / {goalTasks.length} tasks done</span>
                    </div>
                  </div>
                  {renderFinishButton(g, goalTasks)}
                  {!g.completed_at && !g.paused_at && (
                    <MainGoalToggle isMain={!!g.is_main} onToggle={() => setMainGoal(g, !g.is_main)} />
                  )}
                  <span className="goal-list-chevron">{isOpen ? "⌄" : "›"}</span>
                </div>

                {isOpen && (
                  <div className="goal-list-row-expanded">
                    {renderGoalBody(g, goalTasks, pace, pct, doneCount, { showHeader: false })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )
    );
  }

  return (
    <div>
      <TaskEditModal
        task={editingTask}
        tasks={tasks}
        goals={goals}
        onClose={() => setEditingTask(null)}
        onSaved={loadData}
      />
      <Celebration trigger={celebration.key} message={celebration.message} subtitle={celebration.subtitle} />
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <h1>Goals</h1>
          <p className="page-sub">Track progress toward the things that matter beyond day-to-day tasks.</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="row goals-view-toggle" style={{ gap: 4 }}>
            <button
              className={`ghost view-toggle-btn ${view === "grid" ? "active" : ""}`}
              onClick={() => changeView("grid")}
              aria-label="Grid view"
            >
              <Icon name="grid" size={14} />
            </button>
            <button
              className={`ghost view-toggle-btn ${view === "list" ? "active" : ""}`}
              onClick={() => changeView("list")}
              aria-label="List view"
            >
              <Icon name="list" size={15} />
            </button>
          </div>
          <button className="primary" onClick={() => setAddOpen(true)}>+ Add goal</button>
        </div>
      </div>

      {loading && (
        <div className="card" style={{ marginTop: 16 }}>
          <Skeleton rows={3} />
        </div>
      )}
      {!loading && goals.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">🎯</span>
          <span>No goals yet. Add one above.</span>
        </div>
      )}

      {!loading && goals.length > 0 && activeGoals.length === 0 && (
        <p className="muted" style={{ marginTop: 16 }}>No active goals right now. Add one above.</p>
      )}
      {/* Shown whenever nothing is starred, including right after the main goal is
          finished (finishing clears is_main), so you're prompted to pick the next one. */}
      {activeGoals.length > 0 && !activeGoals.some((g) => g.is_main) && (
        <div className="main-goal-tip">
          <Icon name="starFilled" size={16} />
          <p>
            <strong>Give one goal your best energy.</strong> When everything is a priority, nothing moves. Pick
            the one goal that matters most right now, and let the others wait their turn. Tap the ☆ on a goal
            to make it your main one.
          </p>
        </div>
      )}
      {activeGoals.length > ACTIVE_GOAL_NUDGE && (
        <p className="goals-nudge">
          You have {activeGoals.length} active goals. Pausing a few can help the rest move. Use <em>Pause goal</em>{" "}
          in a goal&apos;s ⋯ menu.
        </p>
      )}
      {renderGoalCollection(activeGoals)}

      {pausedGoals.length > 0 && (
        <section className="finished-goals">
          <h2 className="task-group-header">
            <button type="button" className="task-group-toggle" aria-expanded={showPaused} onClick={togglePaused}>
              <span className={`task-group-chevron ${showPaused ? "open" : ""}`}>
                <Icon name="chevronRight" size={14} />
              </span>
              Paused goals
              <span className="task-group-count">{pausedGoals.length}</span>
            </button>
          </h2>
          {showPaused && renderGoalCollection(pausedGoals)}
        </section>
      )}

      {finishedGoals.length > 0 && (
        <section className="finished-goals">
          <h2 className="task-group-header">
            <button
              type="button"
              className="task-group-toggle"
              aria-expanded={showFinished}
              onClick={toggleFinished}
            >
              <span className={`task-group-chevron ${showFinished ? "open" : ""}`}>
                <Icon name="chevronRight" size={14} />
              </span>
              Finished goals
              <span className="task-group-count">{finishedGoals.length}</span>
            </button>
          </h2>
          {showFinished && (
            <>
              {renderGoalCollection(finishedGoals.slice(0, finishedLimit))}
              {(finishedHidden > 0 || finishedLimit > FINISHED_PAGE) && (
                <div className="finished-goals-more">
                  {finishedHidden > 0 ? (
                    <button
                      type="button"
                      className="ghost small-btn"
                      onClick={() => setFinishedLimit((n) => n + FINISHED_PAGE)}
                    >
                      Show more ({finishedHidden})
                    </button>
                  ) : (
                    <button type="button" className="ghost small-btn" onClick={() => setFinishedLimit(FINISHED_PAGE)}>
                      Show less
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add goal">
        <form className="form-grid" onSubmit={addGoal}>
          <div className="field field-full">
            <label htmlFor="goal-name">Goal name</label>
            <input
              id="goal-name"
              type="text"
              placeholder="e.g. Learn Spanish"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field field-full">
            <label htmlFor="goal-target">Target date</label>
            <input id="goal-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="field field-full">
            <label htmlFor="goal-notes">Notes</label>
            <textarea
              id="goal-notes"
              rows={3}
              placeholder="Why this goal matters, how you'll approach it…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="primary">Add goal</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
