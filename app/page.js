"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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

      <form className="add-form" onSubmit={addTask}>
        <input
          type="text"
          placeholder="New task name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: "1 1 200px" }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>General Life</option>
          <option>Goal-Related</option>
        </select>
        {category === "Goal-Related" && (
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">Select goal...</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <select value={effort} onChange={(e) => setEffort(e.target.value)}>
          <option>Small</option>
          <option>Medium</option>
          <option>Large</option>
        </select>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <button type="submit" className="primary">Add task</button>
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
        {!loading && visibleTasks.length === 0 && <p className="muted">No tasks yet.</p>}
        {visibleTasks.map((t) => (
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
            <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
            <span className={`badge ${t.category === "Goal-Related" ? "badge-goal" : "badge-life"}`}>
              {t.category}
            </span>
            {t.due_date && <span className="muted">{t.due_date}</span>}
            <button onClick={() => deleteTask(t.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
