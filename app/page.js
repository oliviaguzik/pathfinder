"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Select from "./components/Select";
import Modal from "./components/Modal";
import Popover from "./components/Popover";

// Date-only strings (YYYY-MM-DD) parse as UTC midnight by default, which drifts
// to the wrong local calendar day near midnight. Anchor to local midnight instead.
function parseLocalDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function toISODateLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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

function sortTasksList(list, sortBy) {
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
  return list;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TasksPage() {
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

  const [name, setName] = useState("");
  const [category, setCategory] = useState("General Life");
  const [goalId, setGoalId] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [effort, setEffort] = useState("Medium");
  const [dueDate, setDueDate] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("General Life");
  const [editGoalId, setEditGoalId] = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editEffort, setEditEffort] = useState("Medium");
  const [editDueDate, setEditDueDate] = useState("");

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

  async function addTask(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await supabase.from("tasks").insert({
      name,
      category,
      goal_id: category === "Goal-Related" && goalId ? goalId : null,
      priority,
      effort,
      due_date: dueDate || null,
      status: "To Do",
    });
    setName("");
    setDueDate("");
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

  function startEditTask(task) {
    setEditingId(task.id);
    setEditName(task.name);
    setEditCategory(task.category);
    setEditGoalId(task.goal_id || "");
    setEditPriority(task.priority || "Medium");
    setEditEffort(task.effort || "Medium");
    setEditDueDate(task.due_date || "");
  }

  function cancelEditTask() {
    setEditingId(null);
  }

  async function saveEditTask(id) {
    if (!editName.trim()) return;
    await supabase.from("tasks").update({
      name: editName,
      category: editCategory,
      goal_id: editCategory === "Goal-Related" && editGoalId ? editGoalId : null,
      priority: editPriority,
      effort: editEffort,
      due_date: editDueDate || null,
    }).eq("id", id);
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

  function renderEditFields(idForSave) {
    return (
      <>
        <div className="field field-full">
          <label>Task name</label>
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Category</label>
          <Select value={editCategory} onChange={setEditCategory} options={["General Life", "Goal-Related"]} />
        </div>
        {editCategory === "Goal-Related" && (
          <div className="field">
            <label>Goal</label>
            <Select
              value={editGoalId}
              onChange={setEditGoalId}
              options={[{ value: "", label: "Select goal..." }, ...goals.map((g) => ({ value: g.id, label: g.name }))]}
            />
          </div>
        )}
        <div className="field">
          <label>Priority</label>
          <Select value={editPriority} onChange={setEditPriority} options={["High", "Medium", "Low"]} />
        </div>
        <div className="field">
          <label>Effort</label>
          <Select value={editEffort} onChange={setEditEffort} options={["Small", "Medium", "Large"]} />
        </div>
        <div className="field">
          <label>Due date</label>
          <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="primary" onClick={() => saveEditTask(idForSave)}>Save</button>
          <button onClick={cancelEditTask}>Cancel</button>
        </div>
      </>
    );
  }

  function renderTaskRow(t) {
    return (
      <div className="task-row" key={t.id}>
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
        <span className={`badge badge-${t.priority?.toLowerCase()}`}>Priority: {t.priority}</span>
        {t.effort && (
          <span className="muted effort-abbr" title={`Effort: ${t.effort}`}>{t.effort.charAt(0)}</span>
        )}
        {t.due_date && (
          <span className={isOverdue(t) ? "due-date overdue" : isDueToday(t) ? "due-date today" : "muted due-date"}>
            {isOverdue(t) ? `Overdue: ${t.due_date}` : isDueToday(t) ? "Due today" : `Due ${t.due_date}`}
          </span>
        )}
        <div className="task-actions">
          <button className="ghost icon-btn" onClick={() => startEditTask(t)} aria-label="Edit task" title="Edit">✎</button>
          <button className="ghost icon-btn" onClick={() => deleteTask(t.id)} aria-label="Delete task" title="Delete">×</button>
        </div>
      </div>
    );
  }

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthLabel = calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const grid = getMonthGrid(year, month);
  const today = new Date();

  const tasksByDate = {};
  const undatedTasks = [];
  for (const t of visibleTasks) {
    if (!t.due_date) {
      undatedTasks.push(t);
      continue;
    }
    (tasksByDate[t.due_date] ||= []).push(t);
  }

  return (
    <div>
      <h1>Tasks</h1>
      <p className="page-sub">Everything on your plate, general life and goal-related alike.</p>

      <form className="form-grid" onSubmit={addTask}>
        <div className="field field-full">
          <label htmlFor="task-name">Task name</label>
          <input
            id="task-name"
            type="text"
            placeholder="e.g. Book dentist appointment"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="task-category">Category</label>
          <Select
            id="task-category"
            value={category}
            onChange={setCategory}
            options={["General Life", "Goal-Related"]}
          />
        </div>
        {category === "Goal-Related" && (
          <div className="field">
            <label htmlFor="task-goal">Goal</label>
            <Select
              id="task-goal"
              value={goalId}
              onChange={setGoalId}
              options={[{ value: "", label: "Select goal..." }, ...goals.map((g) => ({ value: g.id, label: g.name }))]}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="task-priority">Priority</label>
          <Select id="task-priority" value={priority} onChange={setPriority} options={["High", "Medium", "Low"]} />
        </div>
        <div className="field">
          <label htmlFor="task-effort">Effort</label>
          <Select id="task-effort" value={effort} onChange={setEffort} options={["Small", "Medium", "Large"]} />
        </div>
        <div className="field">
          <label htmlFor="task-due">Due date</label>
          <input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
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
            ☰
          </button>
          <button
            className={`ghost view-toggle-btn ${view === "calendar" ? "active" : ""}`}
            onClick={() => changeView("calendar")}
            aria-label="Calendar view"
          >
            📅
          </button>
        </div>
      </div>

      {view === "list" ? (
        <div className="card" style={{ marginTop: 20 }}>
          {loading && <p className="muted">Loading...</p>}
          {!loading && sortedVisibleTasks.length === 0 && (
            <p className="empty-state">No tasks match these filters yet.</p>
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
          <div className="card calendar-main">
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
                return (
                  <div
                    className={`calendar-cell ${outside ? "outside" : ""} ${isSameDay(date, today) ? "today" : ""}`}
                    key={date.toISOString()}
                  >
                    <div className="calendar-date">{date.getDate()}</div>
                    <div className="calendar-cell-tasks">
                      {dayTasks.map((t) => (
                        <div className="calendar-task" key={t.id}>
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

          <div className="card calendar-side">
            <div className="section-label">No due date</div>
            {loading && <p className="muted">Loading...</p>}
            {!loading && undatedTasks.length === 0 && <p className="muted">Nothing here.</p>}
            {undatedTasks.map((t) => renderTaskRow(t))}
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
