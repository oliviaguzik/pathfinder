"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthProvider";
import { notifyUndo } from "../../lib/notify";
import { nextPosition } from "../../lib/reorder";
import { deleteTaskAndSync, restoreTask, toggleTaskDone, undoTaskDone } from "../../lib/taskActions";
import { deleteEvent, restoreEvent } from "../../lib/eventActions";

// The Plan page's data (tasks, goals, events) and every change to it.
// Changes show on screen first, then save; the reload afterwards brings in
// anything the server added (or undoes the change if the save failed).
export function usePlanData() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  // Just-ticked tasks stay where they are for a moment (shown as done) before
  // moving to Completed, so the check-off is seen rather than vanishing.
  const [lingering, setLingering] = useState(() => new Set());
  // Each change bumps this, so a refresh that started before the change can't
  // land afterwards and put back what was just changed.
  const dataVersion = useRef(0);

  // Only the first load shows placeholders; later refreshes swap data in quietly.
  async function loadData() {
    const version = ++dataVersion.current;
    const [{ data: taskData }, { data: goalData }, { data: eventData }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("goals").select("*"),
      supabase.from("events").select("*"),
    ]);
    if (version !== dataVersion.current) return;
    setTasks(taskData || []);
    setGoals(goalData || []);
    setEvents(eventData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function patchTask(id, patch) {
    dataVersion.current++;
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function isDone(t) {
    return t.status === "Done" || lingering.has(t.id);
  }

  function linger(id, on) {
    setLingering((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // `fields` are the task columns from a form (lib/taskForm.js), plus
  // category and goal_id.
  async function addTask(fields) {
    const { error } = await supabase.from("tasks").insert({
      ...fields,
      status: "To Do",
      position: nextPosition(tasks),
      user_id: user.id,
    });
    loadData();
    return { error };
  }

  async function addEvent(fields) {
    const { error } = await supabase.from("events").insert(fields);
    if (!error) loadData();
    return { error };
  }

  async function toggleDone(shown) {
    const task = tasks.find((t) => t.id === shown.id);
    if (!task) return;
    const done = !isDone(task);
    if (!done && lingering.has(task.id)) linger(task.id, false);
    patchTask(task.id, { status: done ? "Done" : "To Do", completed_at: done ? new Date().toISOString() : null });
    if (done) {
      linger(task.id, true);
      setTimeout(() => linger(task.id, false), 1400);
    }
    // Unticking during the linger: the task was saved as done, so flip it back.
    const saved = done ? task : { ...task, status: "Done" };
    const saving = toggleTaskDone(saved, { tasks, goals, userId: user.id });
    if (done) {
      notifyUndo(`Done: ${task.name}`, async () => {
        linger(task.id, false);
        patchTask(task.id, { status: "To Do", completed_at: null });
        await undoTaskDone(task, await saving, { tasks, goals, userId: user.id });
        loadData();
      });
    }
    await saving;
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

  async function removeEvent(ev) {
    dataVersion.current++;
    setEvents((list) => list.filter((e) => e.id !== ev.id));
    const deleting = deleteEvent(ev);
    notifyUndo(`Deleted: ${ev.title}`, async () => {
      dataVersion.current++;
      setEvents((list) => [...list, ev]);
      await deleting;
      await restoreEvent(ev);
      loadData();
    });
    await deleting;
    loadData();
  }

  async function moveTaskToDate(taskId, dueDateStr) {
    patchTask(taskId, { due_date: dueDateStr });
    await supabase.from("tasks").update({ due_date: dueDateStr }).eq("id", taskId);
    loadData();
  }

  async function setTaskPosition(taskId, position) {
    patchTask(taskId, { position });
    await supabase.from("tasks").update({ position }).eq("id", taskId);
    loadData();
  }

  function goalName(id) {
    return goals.find((g) => g.id === id)?.name || "";
  }

  return {
    tasks,
    goals,
    events,
    loading,
    lingering,
    loadData,
    isDone,
    addTask,
    addEvent,
    toggleDone,
    deleteTask,
    removeEvent,
    moveTaskToDate,
    setTaskPosition,
    goalName,
  };
}
