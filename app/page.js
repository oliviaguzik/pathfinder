"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const effortClass = {
  Small: "badge-effort-small",
  Medium: "badge-effort-medium",
  Large: "badge-effort-large",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

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
    return true;
  });

  function goalName(id) {
    return goals.find((g) => g.id === id)?.name || "";
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
          <select id="task-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>General Life</option>
            <option>Goal-Related</option>
          </select>
        </div>
        {category === "Goal-Related" && (
          <div className="field">
            <label htmlFor="task-goal">Goal</label>
            <select id="task-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">Select goal...</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="task-priority">Priority</label>
          <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="task-effort">Effort</label>
          <select id="task-effort" value={effort} onChange={(e) => setEffort(e.target.value)}>
            <option>Small</option>
            <option>Medium</option>
            <option>Large</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="task-due">Due date</label>
          <input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="form-actions">
          <button type="submit" className="primary">Add task</button>
        </div>
      </form>

      <div className="filters">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="All">All categories</option>
          <option>General Life</option>
          <option>Goal-Related</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="All">All statuses</option>
          <option>To Do</option>
          <option>In Progress</option>
          <option>Done</option>
        </select>
      </div>

      <div className="card">
        {loading && <p className="muted">Loading...</p>}
        {!loading && visibleTasks.length === 0 && (
          <p className="empty-state">No tasks match these filters yet.</p>
        )}
        {visibleTasks.map((t) =>
          editingId === t.id ? (
            <div className="task-row edit-row" key={t.id}>
              <div className="form-grid compact" style={{ width: "100%" }}>
                <div className="field field-full">
                  <label>Task name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    <option>General Life</option>
                    <option>Goal-Related</option>
                  </select>
                </div>
                {editCategory === "Goal-Related" && (
                  <div className="field">
                    <label>Goal</label>
                    <select value={editGoalId} onChange={(e) => setEditGoalId(e.target.value)}>
                      <option value="">Select goal...</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>Priority</label>
                  <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
                <div className="field">
                  <label>Effort</label>
                  <select value={editEffort} onChange={(e) => setEditEffort(e.target.value)}>
                    <option>Small</option>
                    <option>Medium</option>
                    <option>Large</option>
                  </select>
                </div>
                <div className="field">
                  <label>Due date</label>
                  <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                </div>
                <div className="form-actions">
                  <button className="primary" onClick={() => saveEditTask(t.id)}>Save</button>
                  <button onClick={cancelEditTask}>Cancel</button>
                </div>
              </div>
            </div>
          ) : (
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
              <div className="badge-group">
                <span className={`badge badge-${t.priority?.toLowerCase()}`}>Priority: {t.priority}</span>
                <span className={`badge ${effortClass[t.effort] || "badge-effort-medium"}`}>Effort: {t.effort}</span>
                <span className={`badge ${t.category === "Goal-Related" ? "badge-goal" : "badge-life"}`}>
                  {t.category}
                </span>
              </div>
              {t.due_date && <span className="muted due-date">Due {t.due_date}</span>}
              <div className="task-actions">
                <button className="ghost" onClick={() => startEditTask(t)}>Edit</button>
                <button className="danger" onClick={() => deleteTask(t.id)}>Delete</button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
