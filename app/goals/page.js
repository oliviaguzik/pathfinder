"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import CircularProgress from "../components/CircularProgress";
import Modal from "../components/Modal";
import Select from "../components/Select";

// Date-only strings (YYYY-MM-DD) parse as UTC midnight by default, which drifts
// to the wrong local calendar day near midnight. Anchor them to local midnight instead.
function parseLocalDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function todayLocalISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const [view, setView] = useState("grid");
  const [listExpanded, setListExpanded] = useState({});

  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const [addTaskForId, setAddTaskForId] = useState(null);
  const [taskName, setTaskName] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskEffort, setTaskEffort] = useState("Medium");
  const [taskDueDate, setTaskDueDate] = useState("");

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("Medium");
  const [editTaskEffort, setEditTaskEffort] = useState("Medium");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("goalsView");
    if (stored === "grid" || stored === "list") setView(stored);
  }, []);

  function changeView(next) {
    setView(next);
    localStorage.setItem("goalsView", next);
  }

  async function loadData() {
    setLoading(true);
    const [{ data: goalData }, { data: taskData }] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*"),
    ]);
    setGoals(goalData || []);
    setTasks(taskData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addGoal(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await supabase.from("goals").insert({
      name,
      target_date: targetDate || null,
      start_date: todayLocalISODate(),
      status: "In Progress",
    });
    setName("");
    setTargetDate("");
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
  }

  function cancelEditGoal() {
    setEditingGoalId(null);
  }

  async function saveEditGoal(id) {
    if (!editName.trim()) return;
    await supabase.from("goals").update({
      name: editName,
      target_date: editTargetDate || null,
    }).eq("id", id);
    setEditingGoalId(null);
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
    setTaskName("");
    setTaskPriority("Medium");
    setTaskEffort("Medium");
    setTaskDueDate("");
  }

  async function addTaskToGoal(e, goalId) {
    e.preventDefault();
    if (!taskName.trim()) return;
    await supabase.from("tasks").insert({
      name: taskName,
      category: "Goal-Related",
      goal_id: goalId,
      priority: taskPriority,
      effort: taskEffort,
      due_date: taskDueDate || null,
      status: "To Do",
    });
    setTaskName("");
    setTaskDueDate("");
    setAddTaskForId(null);
    loadData();
  }

  function startEditTask(task) {
    setEditingTaskId(task.id);
    setEditTaskName(task.name);
    setEditTaskPriority(task.priority || "Medium");
    setEditTaskEffort(task.effort || "Medium");
    setEditTaskDueDate(task.due_date || "");
  }

  function cancelEditTask() {
    setEditingTaskId(null);
  }

  async function saveEditTask(id) {
    if (!editTaskName.trim()) return;
    await supabase.from("tasks").update({
      name: editTaskName,
      priority: editTaskPriority,
      effort: editTaskEffort,
      due_date: editTaskDueDate || null,
    }).eq("id", id);
    setEditingTaskId(null);
    loadData();
  }

  async function toggleDone(task) {
    const newStatus = task.status === "Done" ? "To Do" : "Done";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    loadData();
  }

  async function deleteTask(id) {
    await supabase.from("tasks").delete().eq("id", id);
    loadData();
  }

  function tasksFor(goalId) {
    return tasks.filter((t) => t.goal_id === goalId);
  }

  function sortByDueDate(list) {
    return [...list].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
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
    if (doneCount === total) {
      return { text: "Completed", cls: "badge-life" };
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
      ? { text: "On track", cls: "badge-life" }
      : { text: "Behind pace", cls: "badge-high" };
  }

  function renderAddTaskForm(goalId) {
    return (
      <form className="form-grid" onSubmit={(e) => addTaskToGoal(e, goalId)}>
        <div className="field field-full">
          <label>Task name</label>
          <input
            type="text"
            placeholder="e.g. Practice verbs"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label>Priority</label>
          <Select value={taskPriority} onChange={setTaskPriority} options={["High", "Medium", "Low"]} />
        </div>
        <div className="field">
          <label>Effort</label>
          <Select value={taskEffort} onChange={setTaskEffort} options={["Small", "Medium", "Large"]} />
        </div>
        <div className="field">
          <label>Due date</label>
          <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
        </div>
        <div className="form-actions">
          <button type="submit" className="primary">Add task</button>
          <button type="button" onClick={() => toggleAddTaskFor(goalId)}>Cancel</button>
        </div>
      </form>
    );
  }

  function renderEditTaskForm(task) {
    return (
      <div className="form-grid compact" style={{ marginBottom: 0 }}>
        <div className="field field-full">
          <label>Task name</label>
          <input type="text" value={editTaskName} onChange={(e) => setEditTaskName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Priority</label>
          <Select value={editTaskPriority} onChange={setEditTaskPriority} options={["High", "Medium", "Low"]} />
        </div>
        <div className="field">
          <label>Effort</label>
          <Select value={editTaskEffort} onChange={setEditTaskEffort} options={["Small", "Medium", "Large"]} />
        </div>
        <div className="field">
          <label>Due date</label>
          <input type="date" value={editTaskDueDate} onChange={(e) => setEditTaskDueDate(e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="primary" onClick={() => saveEditTask(task.id)}>Save</button>
          <button onClick={cancelEditTask}>Cancel</button>
        </div>
      </div>
    );
  }

  function renderTaskRow(t) {
    if (editingTaskId === t.id) {
      return <div key={t.id} style={{ padding: "6px 0" }}>{renderEditTaskForm(t)}</div>;
    }
    return (
      <div className="task-row" key={t.id}>
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          onChange={() => toggleDone(t)}
        />
        <span
          className={`task-name task-name-editable ${t.status === "Done" ? "done" : ""}`}
          onClick={() => startEditTask(t)}
        >
          {t.name}
        </span>
        <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
        <button className="ghost row-delete-btn" onClick={() => deleteTask(t.id)} aria-label="Delete task">×</button>
      </div>
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
          <div className="form-actions">
            <button className="primary" onClick={() => saveEditGoal(g.id)}>Save</button>
            <button onClick={cancelEditGoal}>Cancel</button>
          </div>
        </div>
      );
    }

    const addingHere = addTaskForId === g.id;

    return (
      <>
        {showHeader && (
          <>
            <div className="row-between" style={{ alignItems: "flex-start" }}>
              <span className="goal-tile-name">{g.name}</span>
              {pace && <span className={`badge ${pace.cls}`}>{pace.text}</span>}
            </div>
            {g.target_date && <div className="muted" style={{ marginTop: 4 }}>{targetLine(g)}</div>}
            <div className="row" style={{ marginTop: 10, gap: 10 }}>
              <CircularProgress percent={pct} size={48} strokeWidth={5} />
              <span className="muted">{doneCount} / {goalTasks.length} tasks done</span>
            </div>
          </>
        )}

        <div className="row" style={{ gap: 6, marginTop: showHeader ? 10 : 0 }}>
          <button className="ghost" onClick={() => startEditGoal(g)}>Edit</button>
          <button className="danger" onClick={() => setConfirmingDeleteId(g.id)}>Delete</button>
        </div>

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
            {!addingHere && (
              <button className="ghost" onClick={() => toggleAddTaskFor(g.id)}>+ Add task</button>
            )}
          </div>

          {addingHere && <div className="tile-add-task-form">{renderAddTaskForm(g.id)}</div>}

          <div className="tile-tasks-list">
            {goalTasks.length === 0 && <p className="muted">No tasks linked yet.</p>}
            {goalTasks.map((t) => renderTaskRow(t))}
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <h1>Goals</h1>
          <p className="page-sub">Track progress toward the things that matter beyond day-to-day tasks.</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 4 }}>
            <button
              className={`ghost view-toggle-btn ${view === "grid" ? "active" : ""}`}
              onClick={() => changeView("grid")}
              aria-label="Grid view"
            >
              ⊞
            </button>
            <button
              className={`ghost view-toggle-btn ${view === "list" ? "active" : ""}`}
              onClick={() => changeView("list")}
              aria-label="List view"
            >
              ☰
            </button>
          </div>
          <button className="primary" onClick={() => setAddOpen(true)}>+ Add goal</button>
        </div>
      </div>

      {loading && <p className="muted">Loading...</p>}
      {!loading && goals.length === 0 && <p className="empty-state">No goals yet — add one above.</p>}

      {view === "grid" ? (
        <div className="goal-grid">
          {goals.map((g) => {
            const goalTasks = sortByDueDate(tasksFor(g.id));
            const doneCount = goalTasks.filter((t) => t.status === "Done").length;
            const pct = goalTasks.length > 0 ? Math.round((doneCount / goalTasks.length) * 100) : 0;
            const pace = paceLabel(g, goalTasks);

            return (
              <div className="card goal-tile-full" key={g.id}>
                {renderGoalBody(g, goalTasks, pace, pct, doneCount)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="goal-list">
          {goals.map((g) => {
            const goalTasks = sortByDueDate(tasksFor(g.id));
            const doneCount = goalTasks.filter((t) => t.status === "Done").length;
            const pct = goalTasks.length > 0 ? Math.round((doneCount / goalTasks.length) * 100) : 0;
            const pace = paceLabel(g, goalTasks);
            const isOpen = listExpanded[g.id];

            return (
              <div className="card goal-list-row-full" key={g.id}>
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
                  <CircularProgress percent={pct} size={40} strokeWidth={4} />
                  <div className="goal-list-row-info">
                    <div className="goal-list-row-top">
                      <span className="goal-tile-name">{g.name}</span>
                      {pace && <span className={`badge ${pace.cls}`}>{pace.text}</span>}
                    </div>
                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      {g.target_date && <span className="muted">{targetLine(g)}</span>}
                      <span className="muted">{doneCount} / {goalTasks.length} tasks done</span>
                    </div>
                  </div>
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
          <div className="form-actions">
            <button type="submit" className="primary">Add goal</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
