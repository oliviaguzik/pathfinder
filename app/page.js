"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Skeleton from "./components/Skeleton";
import Icon from "./components/Icon";
import TaskMeta from "./components/TaskMeta";
import EventModal from "./components/EventModal";
import TaskEditModal from "./components/TaskEditModal";
import { eventTimeLabel, sortEvents } from "../lib/events";
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
// planning live on the Plan page.
export default function TodayPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [events, setEvents] = useState([]);
  // The event dialog: { event } to edit one, { date } to add one today.
  const [eventDialog, setEventDialog] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [{ data: taskData }, { data: goalData }, { data: eventData }] = await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("goals").select("*"),
      supabase.from("events").select("*").eq("date", todayLocalISODate()),
    ]);
    setTasks(taskData || []);
    setGoals(goalData || []);
    setEvents(sortEvents(eventData || []));
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
  // Tasks belonging to a paused goal stay off Today until the goal is resumed.
  const pausedGoalIds = new Set(goals.filter((g) => g.paused_at && !g.completed_at).map((g) => g.id));
  const dueNow = tasks.filter(
    (t) => t.status !== "Done" && t.due_date && t.due_date <= today && !pausedGoalIds.has(t.goal_id)
  );
  const todayList = dueNow.filter((t) => !focusIds.has(t.id)).sort(byUrgency);
  const overdueCount = dueNow.filter((t) => t.due_date < today).length;

  // The one main goal (set on the Goals page) and its next step: the open task
  // due soonest, or the oldest one if none have dates.
  const mainGoal = goals.find((g) => g.is_main && !g.completed_at && !g.paused_at);
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

  // The next step already shows in the Today card, so the goal line doesn't repeat it.
  const nextStepShown = !!nextStep && (focusIds.has(nextStep.id) || todayList.some((t) => t.id === nextStep.id));

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
          <span
            className={`task-name task-name-editable ${t.status === "Done" ? "done" : ""}`}
            onClick={() => setEditingTask(t)}
            title="Edit task"
          >
            {t.name}
          </span>
          <TaskMeta
            task={t}
            showDue={overdue}
            goalName={t.category === "Goal-Related" && t.goal_id ? goalName(t.goal_id) : ""}
          />
        </div>
        {overdue && !inFocus && (
          <div className="reschedule">
            <button className="ghost small-btn" onClick={() => moveTo(t, today)}>Today</button>
            <button className="ghost small-btn" onClick={() => moveTo(t, tomorrow)}>Tomorrow</button>
          </div>
        )}
        <div className="today-row-actions">
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

  // Timed events that have already ended fade out.
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const isPast = (ev) => !ev.all_day && (ev.end_time || ev.start_time || "").slice(0, 5) <= nowTime;

  const dueTodayCount = dueNow.length - overdueCount;
  const summary =
    dueNow.length === 0
      ? ["Nothing due today"]
      : [dueTodayCount > 0 && `${dueTodayCount} due today`, overdueCount > 0 && `${overdueCount} overdue`].filter(Boolean);
  if (events.length > 0) summary.push(`${events.length} event${events.length === 1 ? "" : "s"}`);

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
            <section className="main-goal-line">
              <Icon name="starFilled" size={14} />
              <div className="main-goal-line-text">
                <a className="main-goal-line-name" href="/goals">{mainGoal.name}</a>
                <span className="main-goal-line-pct">{mainPct}%</span>
                <span className="main-goal-line-next">
                  {!nextStep
                    ? mainTasks.length > 0
                      ? "All tasks done. Finish it on the Goals page."
                      : "No next step yet. Add one on the Goals page."
                    : nextStepShown
                      ? "Next step is on today's list"
                      : (
                        <>
                          Next: <strong>{nextStep.name}</strong>
                        </>
                      )}
                </span>
              </div>
              {nextStep && !focusIds.has(nextStep.id) && (
                <button
                  className="ghost small-btn main-goal-line-action"
                  onClick={() => setFocus(nextStep, true)}
                  disabled={openFocusCount >= FOCUS_LIMIT}
                  title={openFocusCount >= FOCUS_LIMIT ? `You already have ${FOCUS_LIMIT} focus tasks` : undefined}
                >
                  <Icon name="star" size={14} /> Add to focus
                </button>
              )}
            </section>
          )}

          {/* One card for the day: focus first, then events (by time) and due tasks. */}
          <section className="card today-card">
            <div className="today-card-head">
              <h2>Today</h2>
              <button
                type="button"
                className="ghost small-btn add-event-link"
                onClick={() => setEventDialog({ date: today })}
              >
                <Icon name="plus" size={13} /> Event
              </button>
            </div>

            {(focus.length > 0 || todayList.length > 0) && (
              <div className="today-focus-block">
                <h3 className="today-block-title">
                  <Icon name="starFilled" size={14} />
                  Focus
                  {focus.length > 0 && (
                    <span className="task-group-count">
                      {focus.length - openFocusCount} / {focus.length}
                    </span>
                  )}
                </h3>
                {focus.length === 0 ? (
                  <p className="today-hint">Star up to {FOCUS_LIMIT} tasks below that would make today a win.</p>
                ) : (
                  focus.map(renderRow)
                )}
                {focus.length > 0 && openFocusCount === 0 && (
                  <p className="today-win">🎉 Focus done. Everything else today is a bonus.</p>
                )}
              </div>
            )}

            {(events.length > 0 || todayList.length > 0) && (
              <div className="today-list">
                {events.map((ev) => (
                  <button
                    type="button"
                    key={ev.id}
                    className={`task-row today-row list-event ${isPast(ev) ? "past" : ""}`}
                    onClick={() => setEventDialog({ event: ev })}
                  >
                    <span className="list-event-icon">
                      <Icon name="clock" size={14} />
                    </span>
                    <span className="task-main">
                      <span className="task-name">{ev.title}</span>
                      <span className="task-meta">
                        <span className="meta-item list-event-when">{eventTimeLabel(ev)}</span>
                        {ev.location && <span className="meta-item">{ev.location}</span>}
                      </span>
                    </span>
                  </button>
                ))}
                {todayList.map(renderRow)}
              </div>
            )}

            {focus.length === 0 && events.length === 0 && todayList.length === 0 && (
              <p className="today-hint today-clear">Nothing on today. Enjoy the clear day, or look ahead in Plan.</p>
            )}
          </section>
        </>
      )}
      <TaskEditModal
        task={editingTask}
        tasks={tasks}
        goals={goals}
        onClose={() => setEditingTask(null)}
        onSaved={loadData}
      />
      <EventModal
        open={!!eventDialog}
        event={eventDialog?.event}
        defaultDate={eventDialog?.date}
        onClose={() => setEventDialog(null)}
        onSaved={loadData}
      />
    </div>
  );
}
