"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Skeleton from "../components/Skeleton";
import Icon from "../components/Icon";
import CircularProgress from "../components/CircularProgress";
import { friendlyDate, getWeekDays, parseLocalDate, toISODateLocal, todayLocalISODate, weekLabel } from "../../lib/dates";
import { getPeriod, goalsNeedingAttention, periodReport, shiftAnchor } from "../../lib/insights";

const RANGES = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];
const FINISHED_PER_GROUP = 5;

function shiftDays(dateStr, days) {
  const d = parseLocalDate(dateStr);
  return toISODateLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

// "Today" -> "today" mid-sentence; dates like "Oct 19" stay as they are.
function inSentence(label) {
  return ["Today", "Yesterday", "Tomorrow"].includes(label) ? label.toLowerCase() : label;
}

function contains(period, date) {
  return date >= period.start && date < period.end;
}

function periodTitle(range, period, now) {
  if (range === "year") return String(period.start.getFullYear());
  if (range === "month") return period.start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (contains(period, now)) return "This week";
  if (contains(getPeriod("week", shiftAnchor("week", period.start, 1)), now)) return "Last week";
  return weekLabel(getWeekDays(period.start));
}

// Single-series column chart: one bar per day (week, month) or month (year).
// No legend — the card title names the series. The busiest bucket gets a
// direct label, every bar has a hover tooltip, and a screen-reader table
// carries all values.
function CompletedChart({ buckets, range }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const peak = buckets.reduce((best, b) => (b.count > best.count ? b : best), buckets[0]);
  const now = new Date();
  const showLabel = (i) => range !== "month" || i === 0 || (i + 1) % 5 === 0;

  return (
    <div className="period-chart">
      {buckets.every((b) => b.count === 0) && <p className="period-chart-empty">Nothing checked off in this period.</p>}
      <div
        className="period-chart-plot"
        style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label="Tasks completed over time"
      >
        {buckets.map((b, i) => (
          <div
            className="period-chart-col"
            key={b.start.toISOString()}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {hovered === i && (
              <div className={`chart-tooltip ${i >= buckets.length / 2 ? "left" : "right"}`}>
                <strong>{b.count}</strong> completed
                <span>{b.longLabel}</span>
              </div>
            )}
            <div className="period-chart-bar-area">
              {b.count > 0 && b === peak && <span className="period-chart-value">{b.count}</span>}
              <div
                className={`period-chart-bar ${b.count === 0 ? "empty" : ""}`}
                style={{ height: b.count === 0 ? 2 : `${(b.count / max) * 100}%` }}
              />
            </div>
            <span className={`period-chart-label ${now >= b.start && now < b.end ? "now" : ""}`}>
              {showLabel(i) ? b.label : ""}
            </span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Tasks completed</caption>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.start.toISOString()}>
              <th scope="row">{b.longLabel}</th>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReviewPage() {
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("week");
  const [anchor, setAnchor] = useState(() => new Date());

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
    const stored = localStorage.getItem("reviewRange");
    if (RANGES.some((r) => r.key === stored)) setRange(stored);
  }, []);

  function changeRange(next) {
    setRange(next);
    setAnchor(new Date());
    localStorage.setItem("reviewRange", next);
  }

  const now = new Date();
  const today = todayLocalISODate();
  const period = getPeriod(range, anchor);
  const isCurrent = contains(period, now);
  const report = periodReport(tasks, goals, period);
  const previous = periodReport(tasks, goals, getPeriod(range, shiftAnchor(range, anchor, -1)));
  const delta = report.completed.length - previous.completed.length;
  const best = report.perBucket.reduce((top, b) => (b.count > top.count ? b : top), report.perBucket[0]);

  const overdue = tasks
    .filter((t) => t.status !== "Done" && t.due_date && t.due_date < today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const flags = Object.fromEntries(goalsNeedingAttention(goals, tasks, now).map((a) => [a.goal.id, a]));

  function goalName(id) {
    return goals.find((g) => g.id === id)?.name || "";
  }

  async function moveTo(task, dateStr) {
    await supabase.from("tasks").update({ due_date: dateStr }).eq("id", task.id);
    loadData();
  }

  // Goals: finished in this period first, then active ones by how much moved.
  const goalRows = [
    ...report.goalsFinished.map((g) => ({ goal: g, finished: true })),
    ...goals.filter((g) => !g.completed_at).map((g) => ({ goal: g, finished: false })),
  ]
    .map((row) => ({
      ...row,
      doneInPeriod: report.completed.filter((t) => t.goal_id === row.goal.id).length,
      goalTasks: tasks.filter((t) => t.goal_id === row.goal.id),
    }))
    .sort((a, b) => b.finished - a.finished || b.doneInPeriod - a.doneInPeriod);

  // Finished tasks grouped like the chart (by day, or by month for a year), newest first.
  const finishedGroups = [...report.perBucket]
    .reverse()
    .filter((b) => b.count > 0)
    .map((b) => ({
      bucket: b,
      tasks: report.completed.filter((t) => {
        const d = new Date(t.completed_at);
        return d >= b.start && d < b.end;
      }),
    }));

  const bestLabel =
    best.count === 0
      ? "—"
      : range === "year"
        ? best.start.toLocaleDateString(undefined, { month: "long" })
        : range === "week"
          ? best.start.toLocaleDateString(undefined, { weekday: "long" })
          : best.start.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div>
      <div className="review-header">
        <div>
          <h1>Review</h1>
          <p className="page-sub">Look back at what you got done, and clear the decks for what&apos;s next.</p>
        </div>
        <div className="review-controls">
          <div className="segmented" role="group" aria-label="Review range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={range === r.key ? "active" : ""}
                aria-pressed={range === r.key}
                onClick={() => changeRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="review-period-nav">
            <button
              className="ghost icon-btn"
              onClick={() => setAnchor((a) => shiftAnchor(range, a, -1))}
              aria-label={`Previous ${range}`}
            >
              ‹
            </button>
            <span className="review-period-label">{periodTitle(range, period, now)}</span>
            <button
              className="ghost icon-btn"
              onClick={() => setAnchor((a) => shiftAnchor(range, a, 1))}
              disabled={isCurrent}
              aria-label={`Next ${range}`}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <Skeleton rows={4} />
        </div>
      ) : (
        <div className="review-stack">
          <section className="card summary-strip">
            <div className="summary-stat">
              <span className="stat-label">Tasks completed</span>
              <span className="stat-value">{report.completed.length}</span>
              <span className={`stat-note ${delta > 0 ? "up" : ""}`}>
                {delta === 0
                  ? `Same as the ${range} before`
                  : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} vs the ${range} before`}
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Goals finished</span>
              <span className="stat-value">{report.goalsFinished.length}</span>
              <span className="stat-note">
                {report.goalsFinished.length > 0
                  ? report.goalsFinished.map((g) => g.name).join(", ")
                  : `${goals.filter((g) => !g.completed_at).length} in progress`}
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Best {range === "year" ? "month" : "day"}</span>
              <span className="stat-value">{bestLabel}</span>
              <span className="stat-note">{best.count > 0 ? `${best.count} tasks completed` : "Nothing completed yet"}</span>
            </div>
          </section>

          <section className="card review-card">
            <h2 className="review-card-title">Tasks completed</h2>
            <CompletedChart buckets={report.perBucket} range={range} />
          </section>

          <div className="review-columns">
            <section className="card review-card">
              <h2 className="review-card-title">
                Goals
                <span className="task-group-count">{goalRows.length}</span>
              </h2>
              {goalRows.length === 0 && <p className="today-hint">No goals yet. Set one on the Goals page.</p>}
              {goalRows.map(({ goal, finished, doneInPeriod, goalTasks }) => {
                const doneCount = goalTasks.filter((t) => t.status === "Done").length;
                const pct = goalTasks.length ? Math.round((doneCount / goalTasks.length) * 100) : 0;
                const flag = !finished && flags[goal.id];
                return (
                  <a className="review-goal" href="/goals" key={goal.id}>
                    <CircularProgress percent={finished ? 100 : pct} size={38} strokeWidth={4} />
                    <span className="attention-text">
                      <span className="attention-name">{goal.name}</span>
                      <span className="attention-reason">
                        {finished
                          ? `Finished ${inSentence(friendlyDate(toISODateLocal(new Date(goal.completed_at))))}`
                          : flag
                            ? flag.text
                            : `${goalTasks.length - doneCount} open tasks`}
                      </span>
                    </span>
                    <span className={`review-goal-count ${doneInPeriod > 0 ? "" : "zero"}`}>
                      {doneInPeriod}
                      <span>done</span>
                    </span>
                  </a>
                );
              })}
            </section>

            <section className="card review-card">
              <h2 className="review-card-title">
                Finished
                <span className="task-group-count">{report.completed.length}</span>
              </h2>
              {finishedGroups.length === 0 && (
                <p className="today-hint">Nothing yet. Tasks you check off are counted here.</p>
              )}
              {finishedGroups.map(({ bucket, tasks: groupTasks }) => (
                <div className="review-day" key={bucket.start.toISOString()}>
                  <div className="review-day-label">
                    {bucket.longLabel}
                    <span>{groupTasks.length}</span>
                  </div>
                  {groupTasks.slice(0, FINISHED_PER_GROUP).map((t) => (
                    <div className="done-item" key={t.id}>
                      <Icon name="check" size={14} />
                      <span>{t.name}</span>
                      {t.goal_id && <span className="done-item-goal">{goalName(t.goal_id)}</span>}
                    </div>
                  ))}
                  {groupTasks.length > FINISHED_PER_GROUP && (
                    <div className="review-more">+{groupTasks.length - FINISHED_PER_GROUP} more</div>
                  )}
                </div>
              ))}
            </section>
          </div>

          {isCurrent && overdue.length > 0 && (
            <section className="card review-card">
              <h2 className="review-card-title overdue">
                Needs a decision
                <span className="task-group-count">{overdue.length}</span>
              </h2>
              <p className="today-hint">Overdue tasks: give each a realistic new date, or take the date off.</p>
              {overdue.map((t) => (
                <div className="task-row today-row" key={t.id}>
                  <div className="task-main">
                    <span className="task-name">{t.name}</span>
                    <span className="due-date overdue review-overdue-date">Was due {inSentence(friendlyDate(t.due_date))}</span>
                  </div>
                  <div className="today-row-actions always">
                    <button className="ghost small-btn" onClick={() => moveTo(t, today)}>Today</button>
                    <button className="ghost small-btn" onClick={() => moveTo(t, shiftDays(today, 1))}>Tomorrow</button>
                    <button className="ghost small-btn" onClick={() => moveTo(t, shiftDays(today, 7))}>Next week</button>
                    <button className="ghost small-btn" onClick={() => moveTo(t, null)}>No date</button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
