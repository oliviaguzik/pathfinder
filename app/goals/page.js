"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");

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
      start_date: new Date().toISOString().slice(0, 10),
      status: "In Progress",
    });
    setName("");
    setTargetDate("");
    loadData();
  }

  async function toggleDone(task) {
    const newStatus = task.status === "Done" ? "To Do" : "Done";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    loadData();
  }

  function toggleExpand(goalId) {
    setExpanded((prev) => ({ ...prev, [goalId]: !prev[goalId] }));
  }

  function tasksFor(goalId) {
    return tasks.filter((t) => t.goal_id === goalId);
  }

  function paceLabel(goal, goalTasks) {
    if (!goal.target_date) return null;
    const today = new Date();
    const start = goal.start_date ? new Date(goal.start_date) : new Date(goal.created_at);
    const target = new Date(goal.target_date);
    if (today < start) return { text: "Not started yet", cls: "badge-low" };
    if (today > target) return { text: "Past due", cls: "badge-high" };
    const totalDays = (target - start) / 86400000;
    const elapsedDays = (today - start) / 86400000;
    const timePct = totalDays > 0 ? elapsedDays / totalDays : 1;
    const doneCount = goalTasks.filter((t) => t.status === "Done").length;
    const donePct = goalTasks.length > 0 ? doneCount / goalTasks.length : 0;
    return donePct >= timePct
      ? { text: "On track", cls: "badge-life" }
      : { text: "Behind pace", cls: "badge-high" };
  }

  return (
    <div>
      <h1>Goals</h1>

      <form className="add-form" onSubmit={addGoal}>
        <input
          type="text"
          placeholder="New goal name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: "1 1 200px" }}
        />
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        <button type="submit" className="primary">Add goal</button>
      </form>

      {loading && <p className="muted">Loading...</p>}
      {!loading && goals.length === 0 && <p className="muted">No goals yet.</p>}

      {goals.map((g) => {
        const goalTasks = tasksFor(g.id);
        const doneCount = goalTasks.filter((t) => t.status === "Done").length;
        const pct = goalTasks.length > 0 ? Math.round((doneCount / goalTasks.length) * 100) : 0;
        const pace = paceLabel(g, goalTasks);
        const isOpen = expanded[g.id];

        return (
          <div className="card" key={g.id}>
            <div className="row-between">
              <div>
                <strong>{g.name}</strong>
                {g.target_date && <div className="muted">Target: {g.target_date}</div>}
              </div>
              {pace && <span className={`badge ${pace.cls}`}>{pace.text}</span>}
            </div>

            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="muted">{doneCount} / {goalTasks.length} tasks done ({pct}%)</div>

            <button onClick={() => toggleExpand(g.id)} style={{ marginTop: 10 }}>
              {isOpen ? "Hide tasks" : "Show tasks"}
            </button>

            {isOpen && (
              <div style={{ marginTop: 8 }}>
                {goalTasks.length === 0 && <p className="muted">No tasks linked yet.</p>}
                {goalTasks.map((t) => (
                  <div className="task-row" key={t.id}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={t.status === "Done"}
                      onChange={() => toggleDone(t)}
                    />
                    <span className={`task-name ${t.status === "Done" ? "done" : ""}`}>{t.name}</span>
                    <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
