"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Skeleton from "./components/Skeleton";
import Icon from "./components/Icon";
import TaskMeta from "./components/TaskMeta";
import CircularProgress from "./components/CircularProgress";
import { toggleTaskDone } from "../lib/taskActions";
import { toISODateLocal, todayLocalISODate } from "../lib/dates";
import { useAuth } from "../lib/AuthProvider";

const FOCUS_LIMIT = 3;
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

function greeting(now) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Overdue first (oldest first), then today's tasks by priority.
function byUrgency(a, b) {
  if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
  return (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
}

// The home screen answers one question: what matters today? Adding and
// planning live on the Tasks page.
export default function TodayPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [{ data: taskData }, { data: goalData }] = await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("goals").select("*"),
    ]);
    setTasks(taskData || []);
    setGoals(goalData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const now = new Date();
  const today = todayLocalISODate();
  const tomorrow = toISODateLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const firstName = (user?.user_metadata?.full_name || user?.user_metadata?.name || "").split(" ")[0];

  const focus = tasks
    .filter((t) => t.focus_date === today)
    .sort((a, b) => (a.status === "Done") - (b.status === "Done"));
  const focusIds = new Set(focus.map((t) => t.id));
  const openFocusCount = focus.filter((t) => t.status !== "Done").length;
  const dueNow = tasks.filter((t) => t.status !== "Done" && t.due_date && t.due_date <= today);
  const todayList = dueNow.filter((t) => !focusIds.has(t.id)).sort(byUrgency);
  const overdueCount = dueNow.filter((t) => t.due_date < today).length;

  // The one main goal (set on the Goals page) and its next step: the open task
  // due soonest, or the oldest one if none have dates.
  const mainGoal = goals.find((g) => g.is_main && !g.completed_at);
  const mainTasks = mainGoal ? tasks.filter((t) => t.goal_id === mainGoal.id) : [];
  const mainDone = mainTasks.filter((t) => t.status === "Done").length;
  const mainPct = mainTasks.length ? Math.round((mainDone / mainTasks.length) * 100) : 0;
  const nextStep = mainTasks
    .filter((t) => t.status !== "Done")
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return (a.created_at || "").localeCompare(b.created_at || "");
    })[0];

  function goalName(id) {
    return goals.find((g) => g.id === id)?.name || "";
  }

  async function toggleDone(task) {
    await toggleTaskDone(task, { tasks, goals, userId: user.id });
    loadData();
  }

  async function setFocus(task, on) {
    await supabase.from("tasks").update({ focus_date: on ? today : null }).eq("id", task.id);
    loadData();
  }

  async function moveTo(task, dateStr) {
    await supabase.from("tasks").update({ due_date: dateStr }).eq("id", task.id);
    loadData();
  }

  function renderRow(t) {
    const inFocus = focusIds.has(t.id);
    const overdue = t.status !== "Done" && t.due_date && t.due_date < today;
    const focusFull = openFocusCount >= FOCUS_LIMIT;
    return (
      <div className="task-row today-row" key={t.id}>
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          onChange={() => toggleDone(t)}
          aria-label={`Mark "${t.name}" ${t.status === "Done" ? "not done" : "done"}`}
        />
        <div className="task-main">
          <span className={`task-name ${t.status === "Done" ? "done" : ""}`}>{t.name}</span>
          <TaskMeta
            task={t}
            showDue={overdue}
            goalName={t.category === "Goal-Related" && t.goal_id ? goalName(t.goal_id) : ""}
          />
        </div>
        <div className="today-row-actions">
          {overdue && !inFocus && (
            <>
              <button className="ghost small-btn" onClick={() => moveTo(t, today)}>Today</button>
              <button className="ghost small-btn" onClick={() => moveTo(t, tomorrow)}>Tomorrow</button>
            </>
          )}
          {t.status !== "Done" && (
            <button
              className={`ghost icon-btn focus-btn ${inFocus ? "on" : ""}`}
              onClick={() => setFocus(t, !inFocus)}
              disabled={!inFocus && focusFull}
              aria-pressed={inFocus}
              aria-label={inFocus ? "Remove from today's focus" : "Add to today's focus"}
              title={
                inFocus
                  ? "Remove from today's focus"
                  : focusFull
                    ? `You already have ${FOCUS_LIMIT} focus tasks`
                    : "Add to today's focus"
              }
            >
              <Icon name={inFocus ? "starFilled" : "star"} size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  const dueTodayCount = dueNow.length - overdueCount;
  const summary =
    dueNow.length === 0
      ? ["Nothing due today"]
      : [dueTodayCount > 0 && `${dueTodayCount} due today`, overdueCount > 0 && `${overdueCount} overdue`].filter(Boolean);

  return (
    <div className="today-page">
      <p className="today-date">
        {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </p>
      <h1>
        {greeting(now)}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      {!loading && <p className="page-sub">{summary.join(" · ")}</p>}

      {loading ? (
        <div className="card">
          <Skeleton rows={4} />
        </div>
      ) : (
        <>
          {mainGoal && (
            <section className="card main-goal-card">
              <CircularProgress percent={mainPct} size={44} strokeWidth={4} />
              <div className="main-goal-card-text">
                <span className="main-goal-card-label">
                  <Icon name="starFilled" size={12} />
                  Main goal
                </span>
                <a className="main-goal-card-name" href="/goals">{mainGoal.name}</a>
                <span className="main-goal-card-next">
                  {nextStep ? (
                    <>
                      Next step: <strong>{nextStep.name}</strong>
                    </>
                  ) : mainTasks.length > 0 ? (
                    "All tasks done. Finish it on the Goals page."
                  ) : (
                    "No next step yet. Add one on the Goals page."
                  )}
                </span>
              </div>
              {nextStep && !focusIds.has(nextStep.id) && (
                <button
                  className="ghost small-btn main-goal-card-action"
                  onClick={() => setFocus(nextStep, true)}
                  disabled={openFocusCount >= FOCUS_LIMIT}
                  title={openFocusCount >= FOCUS_LIMIT ? `You already have ${FOCUS_LIMIT} focus tasks` : undefined}
                >
                  <Icon name="star" size={14} /> Add to focus
                </button>
              )}
              {nextStep && focusIds.has(nextStep.id) && (
                <span className="main-goal-card-infocus">
                  <Icon name="starFilled" size={14} /> In today&apos;s focus
                </span>
              )}
            </section>
          )}

          <section className="card today-section today-focus">
            <h2 className="today-section-title">
              <Icon name="starFilled" size={15} />
              Today&apos;s focus
              {focus.length > 0 && (
                <span className="task-group-count">
                  {focus.length - openFocusCount} / {focus.length}
                </span>
              )}
            </h2>
            {focus.length === 0 ? (
              <p className="today-hint">
                {todayList.length > 0
                  ? `Star up to ${FOCUS_LIMIT} tasks below that would make today a win.`
                  : "Enjoy the clear day, or plan ahead in Tasks."}
              </p>
            ) : (
              focus.map(renderRow)
            )}
            {focus.length > 0 && openFocusCount === 0 && (
              <p className="today-win">🎉 Focus done. Everything else today is a bonus.</p>
            )}
          </section>

          {todayList.length > 0 && (
            <section className="card today-section">
              <h2 className="today-section-title">
                Today
                <span className="task-group-count">{todayList.length}</span>
              </h2>
              {todayList.map(renderRow)}
            </section>
          )}

        </>
      )}
    </div>
  );
}
