"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Select from "./components/Select";
import Modal from "./components/Modal";
import Popover from "./components/Popover";
import Skeleton from "./components/Skeleton";
import Icon from "./components/Icon";
import TaskFields from "./components/TaskFields";
import { recurrenceLabel, nextOccurrence } from "../lib/recurrence";
import { syncGoalStatuses } from "../lib/goalCompletion";
import { positionBetween, nextPosition, sortByPosition } from "../lib/reorder";
import { parseLocalDate, toISODateLocal } from "../lib/dates";
import { EMPTY_TASK_FORM, taskFormFromTask, taskFieldsFromForm } from "../lib/taskForm";
import { useAuth } from "../lib/AuthProvider";

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
  }
  return cells;
}

function isOverdue(task) {
  if (!task.due_date || task.status === "Done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseLocalDate(task.due_date) < today;
}

function isDueToday(task) {
  if (!task.due_date || task.status === "Done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseLocalDate(task.due_date).getTime() === today.getTime();
}

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

const EFFORT_RANK = { Small: 0, Medium: 1, Large: 2 };

function sortByCriterion(list, sortBy) {
  if (sortBy === "due") {
    return [...list].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }
  if (sortBy === "priority") {
    return [...list].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3));
  }
  if (sortBy === "effort") {
    return [...list].sort((a, b) => (EFFORT_RANK[a.effort] ?? 3) - (EFFORT_RANK[b.effort] ?? 3));
  }
  if (sortBy === "oldest") {
    return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  if (sortBy === "newest") {
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  if (sortBy === "custom") {
    return sortByPosition(list);
  }
  return list;
}

// Completed tasks always sink to the bottom, regardless of the active sort.
function sortTasksList(list, sortBy) {
  const notDone = list.filter((t) => t.status !== "Done");
  const done = list.filter((t) => t.status === "Done");
  return [...sortByCriterion(notDone, sortBy), ...sortByCriterion(done, sortBy)];
}

function sortDoneLast(list) {
  return [...list].sort((a, b) => (a.status === "Done") - (b.status === "Done"));
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterEffort, setFilterEffort] = useState("All");
  const [sortBy, setSortBy] = useState("due");

  const [view, setView] = useState("list");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const calendarMainRef = useRef(null);
  const [calendarSideMaxHeight, setCalendarSideMaxHeight] = useState(null);

  const [newTask, setNewTask] = useState(EMPTY_TASK_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_TASK_FORM);

  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [confirmingDeleteTaskId, setConfirmingDeleteTaskId] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("tasksView");
    if (stored === "list" || stored === "calendar") setView(stored);
  }, []);

  function changeView(next) {
    setView(next);
    localStorage.setItem("tasksView", next);
  }

  async function loadData() {
    setLoading(true);
    const [{ data: taskData }, { data: goalData }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("goals").select("*"),
    ]);
    setTasks(taskData || []);
    setGoals(goalData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Cap the "No due date" panel's height to match the calendar's actual rendered
  // height (measured, since CSS grid/flex stretch alone can't reliably do this —
  // a tall unbounded list inflates the shared row height instead of being capped by it).
  useEffect(() => {
    if (view !== "calendar") return;
    function measure() {
      if (calendarMainRef.current) {
        setCalendarSideMaxHeight(calendarMainRef.current.offsetHeight);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, calendarDate, tasks]);

  async function addTask(e) {
    e.preventDefault();
    if (!newTask.name.trim()) return;
    await supabase.from("tasks").insert({
      ...taskFieldsFromForm(newTask),
      category: newTask.category,
      goal_id: newTask.category === "Goal-Related" && newTask.goalId ? newTask.goalId : null,
      status: "To Do",
      position: nextPosition(tasks),
      user_id: user.id,
    });
    // Category, goal, priority and effort stay selected for the next task.
    setNewTask((f) => ({
      ...f,
      name: "",
      dueDate: "",
      recurring: false,
      recurrencePreset: "daily",
      recurrenceCustomDays: "2",
    }));
    loadData();
  }

  async function toggleDone(task) {
    const newStatus = task.status === "Done" ? "To Do" : "Done";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    if (newStatus === "Done" && task.recurring) {
      await supabase.from("tasks").insert({ ...nextOccurrence(task, toISODateLocal, parseLocalDate), user_id: user.id });
    }
    const tasksAfter = tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t));
    await syncGoalStatuses([task.goal_id], goals, tasksAfter);
    loadData();
  }

  async function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    await supabase.from("tasks").delete().eq("id", id);
    await syncGoalStatuses([task?.goal_id], goals, tasks.filter((t) => t.id !== id));
    loadData();
  }

  // First click arms the delete button (auto-disarms after a few seconds);
  // a second click while armed actually deletes. Avoids a fat-finger delete
  // on a dense list without a full confirm panel per row.
  function handleDeleteClick(id) {
    if (confirmingDeleteTaskId === id) {
      deleteTask(id);
      setConfirmingDeleteTaskId(null);
      return;
    }
    setConfirmingDeleteTaskId(id);
    setTimeout(() => {
      setConfirmingDeleteTaskId((current) => (current === id ? null : current));
    }, 3000);
  }

  async function moveTaskToDate(taskId, dueDateStr) {
    await supabase.from("tasks").update({ due_date: dueDateStr }).eq("id", taskId);
    loadData();
  }

  async function reorderTask(draggedId, targetId, placeAfter) {
    if (!draggedId || draggedId === targetId) return;
    const ordered = sortedVisibleTasks.filter((t) => t.id !== draggedId);
    const targetIndex = ordered.findIndex((t) => t.id === targetId);
    if (targetIndex === -1) return;
    const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
    const prev = ordered[insertIndex - 1];
    const next = ordered[insertIndex];
    const newPosition = positionBetween(prev?.position, next?.position);
    await supabase.from("tasks").update({ position: newPosition }).eq("id", draggedId);
    if (sortBy !== "custom") setSortBy("custom");
    loadData();
  }

  function startEditTask(task) {
    setEditingId(task.id);
    setEditForm(taskFormFromTask(task));
  }

  function cancelEditTask() {
    setEditingId(null);
  }

  async function saveEditTask(id) {
    if (!editForm.name.trim()) return;
    const oldGoalId = tasks.find((t) => t.id === id)?.goal_id;
    const newGoalId = editForm.category === "Goal-Related" && editForm.goalId ? editForm.goalId : null;
    await supabase.from("tasks").update({
      ...taskFieldsFromForm(editForm),
      category: editForm.category,
      goal_id: newGoalId,
    }).eq("id", id);
    if (oldGoalId !== newGoalId) {
      const tasksAfter = tasks.map((t) => (t.id === id ? { ...t, goal_id: newGoalId } : t));
      await syncGoalStatuses([oldGoalId, newGoalId], goals, tasksAfter);
    }
    setEditingId(null);
    loadData();
  }

  const visibleTasks = tasks.filter((t) => {
    if (filterCategory !== "All" && t.category !== filterCategory) return false;
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    if (filterPriority !== "All" && t.priority !== filterPriority) return false;
    if (filterEffort !== "All" && t.effort !== filterEffort) return false;
    return true;
  });
  const sortedVisibleTasks = sortTasksList(visibleTasks, sortBy);

  const activeFilterCount = [filterCategory, filterStatus, filterPriority, filterEffort].filter(
    (v) => v !== "All"
  ).length;

  function clearAllFilters() {
    setFilterCategory("All");
    setFilterStatus("All");
    setFilterPriority("All");
    setFilterEffort("All");
  }

  function goalName(id) {
    return goals.find((g) => g.id === id)?.name || "";
  }

  // Finished goals are closed (as on the Goals page), so they aren't offered
  // for new links — except a task's current goal, so editing doesn't unlink it.
  function goalOptions(currentGoalId) {
    const open = goals.filter((g) => !g.completed_at || g.id === currentGoalId);
    return [{ value: "", label: "Select goal..." }, ...open.map((g) => ({ value: g.id, label: g.name }))];
  }

  function renderEditFields(idForSave) {
    return (
      <>
        <TaskFields
          form={editForm}
          onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
          idPrefix="edit-task"
          autoFocus
          goalOptions={goalOptions(tasks.find((t) => t.id === idForSave)?.goal_id)}
        />
        <div className="form-actions">
          <button
            className="danger"
            style={{ marginRight: "auto" }}
            onClick={() => {
              deleteTask(idForSave);
              cancelEditTask();
            }}
          >
            Delete
          </button>
          <button className="primary" onClick={() => saveEditTask(idForSave)}>Save</button>
          <button onClick={cancelEditTask}>Cancel</button>
        </div>
      </>
    );
  }

  function renderTaskRow(t) {
    return (
      <div
        className={`task-row ${dragOverTaskId === t.id ? "drag-over" : ""}`}
        key={t.id}
        onDragOver={(e) => {
          if (!draggedTaskId) return;
          e.preventDefault();
          setDragOverTaskId(t.id);
        }}
        onDragLeave={() => setDragOverTaskId((id) => (id === t.id ? null : id))}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverTaskId(null);
          const rect = e.currentTarget.getBoundingClientRect();
          const placeAfter = e.clientY > rect.top + rect.height / 2;
          reorderTask(draggedTaskId, t.id, placeAfter);
          setDraggedTaskId(null);
        }}
      >
        <span
          className="drag-handle"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            setDraggedTaskId(t.id);
          }}
          onDragEnd={() => {
            setDraggedTaskId(null);
            setDragOverTaskId(null);
          }}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <Icon name="dragHandle" size={13} />
        </span>
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          onChange={() => toggleDone(t)}
        />
        <span className={`task-name ${t.status === "Done" ? "done" : ""}`}>
          {t.name}
          {t.category === "Goal-Related" && t.goal_id && (
            <span className="muted"> — {goalName(t.goal_id)}</span>
          )}
        </span>
        {t.recurring && (
          <span className="muted recurring-icon" title={recurrenceLabel(t)}>↻</span>
        )}
        {t.priority && (
          <span className={`badge badge-${t.priority.toLowerCase()}`}>Priority: {t.priority}</span>
        )}
        {t.effort && (
          <span className="muted effort-abbr" title={`Effort: ${t.effort}`}>{t.effort.charAt(0)}</span>
        )}
        {t.due_date && (
          <span className={isOverdue(t) ? "due-date overdue" : isDueToday(t) ? "due-date today" : "muted due-date"}>
            {isOverdue(t) ? `Overdue: ${t.due_date}` : isDueToday(t) ? "Due today" : `Due ${t.due_date}`}
          </span>
        )}
        <div className="task-actions">
          <button className="ghost icon-btn" onClick={() => startEditTask(t)} aria-label="Edit task" title="Edit">
            <Icon name="edit" size={14} />
          </button>
          <button
            className={confirmingDeleteTaskId === t.id ? "danger icon-btn" : "ghost icon-btn"}
            onClick={() => handleDeleteClick(t.id)}
            aria-label={confirmingDeleteTaskId === t.id ? "Confirm delete task" : "Delete task"}
            title={confirmingDeleteTaskId === t.id ? "Click again to delete" : "Delete"}
          >
            {confirmingDeleteTaskId === t.id ? "Delete?" : "×"}
          </button>
        </div>
      </div>
    );
  }

  function renderUpcomingTaskRow(t) {
    return (
      <div
        className="undated-task-row"
        key={t.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          setDraggedTaskId(t.id);
        }}
        onDragEnd={() => setDraggedTaskId(null)}
      >
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          onChange={() => toggleDone(t)}
        />
        <div className="upcoming-task-info">
          <span
            className={`upcoming-task-name ${t.status === "Done" ? "done" : ""}`}
            onClick={() => startEditTask(t)}
          >
            {t.name}
          </span>
          <div className={isOverdue(t) ? "due-date overdue" : isDueToday(t) ? "due-date today" : "muted due-date"}>
            {isOverdue(t) ? `Overdue: ${t.due_date}` : isDueToday(t) ? "Due today" : `Due ${t.due_date}`}
          </div>
        </div>
        <button
          className={confirmingDeleteTaskId === t.id ? "danger row-delete-btn" : "ghost row-delete-btn"}
          onClick={() => handleDeleteClick(t.id)}
          aria-label={confirmingDeleteTaskId === t.id ? "Confirm delete task" : "Delete task"}
          title={confirmingDeleteTaskId === t.id ? "Click again to delete" : "Delete"}
        >
          {confirmingDeleteTaskId === t.id ? "Delete?" : "×"}
        </button>
      </div>
    );
  }

  function renderUndatedTaskRow(t) {
    return (
      <div
        className="undated-task-row"
        key={t.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          setDraggedTaskId(t.id);
        }}
        onDragEnd={() => setDraggedTaskId(null)}
      >
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          onChange={() => toggleDone(t)}
        />
        <span
          className={`undated-task-name ${t.status === "Done" ? "done" : ""}`}
          onClick={() => startEditTask(t)}
        >
          {t.name}
        </span>
        <button
          className={confirmingDeleteTaskId === t.id ? "danger row-delete-btn" : "ghost row-delete-btn"}
          onClick={() => handleDeleteClick(t.id)}
          aria-label={confirmingDeleteTaskId === t.id ? "Confirm delete task" : "Delete task"}
          title={confirmingDeleteTaskId === t.id ? "Click again to delete" : "Delete"}
        >
          {confirmingDeleteTaskId === t.id ? "Delete?" : "×"}
        </button>
      </div>
    );
  }

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthLabel = calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const grid = getMonthGrid(year, month);
  const today = new Date();

  const tasksByDate = {};
  const undatedTasksRaw = [];
  for (const t of visibleTasks) {
    if (!t.due_date) {
      undatedTasksRaw.push(t);
      continue;
    }
    (tasksByDate[t.due_date] ||= []).push(t);
  }
  const undatedTasks = sortDoneLast(undatedTasksRaw);
  for (const key of Object.keys(tasksByDate)) {
    tasksByDate[key] = sortDoneLast(tasksByDate[key]);
  }
  const upcomingTasks = sortTasksList(visibleTasks.filter((t) => t.due_date), "due");

  return (
    <div>
      <h1>Tasks</h1>
      <p className="page-sub">Everything on your plate, general life and goal-related alike.</p>

      <form className="form-grid" onSubmit={addTask}>
        <TaskFields
          form={newTask}
          onChange={(patch) => setNewTask((f) => ({ ...f, ...patch }))}
          idPrefix="task"
          namePlaceholder="e.g. Book dentist appointment"
          goalOptions={goalOptions()}
        />
        <div className="form-actions">
          <button type="submit" className="primary">Add task</button>
        </div>
      </form>

      <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Popover
            label={
              <>
                Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </>
            }
            onClear={activeFilterCount > 0 ? clearAllFilters : undefined}
            clearLabel="Clear all filters"
          >
            <div className="filter-panel">
              <div className="filter-panel-row">
                <label>Category</label>
                <Select
                  ariaLabel="Filter by category"
                  value={filterCategory}
                  onChange={setFilterCategory}
                  options={[{ value: "All", label: "All categories" }, "General Life", "Goal-Related"]}
                  onClear={filterCategory !== "All" ? () => setFilterCategory("All") : undefined}
                  clearLabel="Clear category filter"
                />
              </div>
              <div className="filter-panel-row">
                <label>Status</label>
                <Select
                  ariaLabel="Filter by status"
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={[{ value: "All", label: "All statuses" }, "To Do", "Done"]}
                  onClear={filterStatus !== "All" ? () => setFilterStatus("All") : undefined}
                  clearLabel="Clear status filter"
                />
              </div>
              <div className="filter-panel-row">
                <label>Priority</label>
                <Select
                  ariaLabel="Filter by priority"
                  value={filterPriority}
                  onChange={setFilterPriority}
                  options={[{ value: "All", label: "All priorities" }, "High", "Medium", "Low"]}
                  onClear={filterPriority !== "All" ? () => setFilterPriority("All") : undefined}
                  clearLabel="Clear priority filter"
                />
              </div>
              <div className="filter-panel-row">
                <label>Effort</label>
                <Select
                  ariaLabel="Filter by effort"
                  value={filterEffort}
                  onChange={setFilterEffort}
                  options={[{ value: "All", label: "All effort" }, "Small", "Medium", "Large"]}
                  onClear={filterEffort !== "All" ? () => setFilterEffort("All") : undefined}
                  clearLabel="Clear effort filter"
                />
              </div>
              {activeFilterCount > 0 && (
                <button className="ghost filter-panel-clear" onClick={clearAllFilters}>Clear all filters</button>
              )}
            </div>
          </Popover>

          {view === "list" && (
            <div className="sort-control">
              <span className="sort-label">Sort</span>
              <Select
                ariaLabel="Sort tasks"
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: "due", label: "Due date" },
                  { value: "priority", label: "Priority" },
                  { value: "effort", label: "Effort" },
                  { value: "newest", label: "Newest" },
                  { value: "oldest", label: "Oldest" },
                  { value: "custom", label: "Custom (drag to reorder)" },
                ]}
                onClear={sortBy !== "due" ? () => setSortBy("due") : undefined}
                clearLabel="Clear sort"
              />
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 4 }}>
          <button
            className={`ghost view-toggle-btn ${view === "list" ? "active" : ""}`}
            onClick={() => changeView("list")}
            aria-label="List view"
          >
            <Icon name="list" size={15} />
          </button>
          <button
            className={`ghost view-toggle-btn ${view === "calendar" ? "active" : ""}`}
            onClick={() => changeView("calendar")}
            aria-label="Calendar view"
          >
            <Icon name="calendar" size={15} />
          </button>
        </div>
      </div>

      {view === "list" ? (
        <div className="card" style={{ marginTop: 20 }}>
          {loading && <Skeleton rows={4} />}
          {!loading && sortedVisibleTasks.length === 0 && (
            <div className="empty-state">
              <span className="empty-state-icon">🗒️</span>
              <span>No tasks match these filters yet.</span>
            </div>
          )}
          {sortedVisibleTasks.map((t) =>
            editingId === t.id ? (
              <div className="task-row edit-row" key={t.id}>
                <div className="form-grid compact" style={{ width: "100%" }}>
                  {renderEditFields(t.id)}
                </div>
              </div>
            ) : (
              renderTaskRow(t)
            )
          )}
        </div>
      ) : (
        <div className="calendar-wrap">
          <div className="card calendar-main" ref={calendarMainRef}>
            <div className="calendar-header">
              <div className="row" style={{ gap: 4 }}>
                <button
                  className="ghost icon-btn"
                  onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <button
                  className="ghost icon-btn"
                  onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <span className="calendar-title">{monthLabel}</span>
              <button className="ghost" onClick={() => setCalendarDate(new Date())}>Today</button>
            </div>
            <div className="calendar-grid">
              {WEEKDAY_LABELS.map((w) => (
                <div className="calendar-weekday" key={w}>{w}</div>
              ))}
              {grid.map(({ date, outside }) => {
                const dayTasks = tasksByDate[toISODateLocal(date)] || [];
                const cellDateStr = toISODateLocal(date);
                return (
                  <div
                    className={`calendar-cell ${outside ? "outside" : ""} ${isSameDay(date, today) ? "today" : ""} ${draggedTaskId ? "drop-target" : ""}`}
                    key={date.toISOString()}
                    onDragOver={(e) => {
                      if (!draggedTaskId) return;
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedTaskId) moveTaskToDate(draggedTaskId, cellDateStr);
                      setDraggedTaskId(null);
                    }}
                  >
                    <div className="calendar-date">{date.getDate()}</div>
                    <div className="calendar-cell-tasks">
                      {dayTasks.map((t) => (
                        <div
                          className="calendar-task"
                          key={t.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            setDraggedTaskId(t.id);
                          }}
                          onDragEnd={() => setDraggedTaskId(null)}
                        >
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={t.status === "Done"}
                            onChange={() => toggleDone(t)}
                          />
                          <span
                            className={`task-name-editable calendar-task-name ${t.status === "Done" ? "done" : ""}`}
                            onClick={() => startEditTask(t)}
                          >
                            {t.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="card calendar-side"
            style={calendarSideMaxHeight ? { maxHeight: calendarSideMaxHeight } : undefined}
          >
            <div className="calendar-side-section">
              <div className="section-label">Upcoming</div>
              <div className="calendar-side-list">
                {loading && <Skeleton rows={2} />}
                {!loading && upcomingTasks.length === 0 && (
                  <div className="empty-state-mini">
                    <span className="empty-state-icon">✅</span>
                    <span>Nothing upcoming.</span>
                  </div>
                )}
                {upcomingTasks.map((t) => renderUpcomingTaskRow(t))}
              </div>
            </div>

            <div className="calendar-side-section">
              <div className="section-label">No due date</div>
              <div
                className={`calendar-side-list ${draggedTaskId ? "drop-target" : ""}`}
                onDragOver={(e) => {
                  if (!draggedTaskId) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTaskId) moveTaskToDate(draggedTaskId, null);
                  setDraggedTaskId(null);
                }}
              >
                {loading && <Skeleton rows={2} />}
                {!loading && undatedTasks.length === 0 && (
                  <div className="empty-state-mini">
                    <span className="empty-state-icon">📭</span>
                    <span>Nothing here.</span>
                  </div>
                )}
                {undatedTasks.map((t) => renderUndatedTaskRow(t))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={view === "calendar" && !!editingId} onClose={cancelEditTask} title="Edit task">
        <div className="form-grid" style={{ boxShadow: "none", border: "none", padding: 0, margin: 0 }}>
          {editingId && renderEditFields(editingId)}
        </div>
      </Modal>
    </div>
  );
}
