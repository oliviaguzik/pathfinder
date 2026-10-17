"use client";

import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import Skeleton from "../components/Skeleton";
import { occurrencesBetween, sortEvents } from "../../lib/events";
import { getMonthGrid, getWeekDays, isSameDay, parseLocalDate, toISODateLocal, weekLabel } from "../../lib/dates";
import { EMPTY_TASK_FORM, taskFieldsFromForm } from "../../lib/taskForm";
import { sortDoneLast } from "../../lib/taskSort";
import { usePlan } from "./PlanContext";
import { useIsPhone } from "../components/useIsPhone";
import { CalendarEventChip, CalendarTaskChip, ListEvent, SideEventRow, SideTaskRow, TaskRow, WeekEvent, WeekTask } from "./rows";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_CELL_LIMIT = 3;

// The calendar view: Month / Week / Day beside the Scheduled + No date panel.
// Drag a task onto a day to give it that date, or into No date to clear it.
// `dialogOpen` hides the day popup while a task or event dialog is up.
export default function PlanCalendar({ agenda, visibleTasks, dialogOpen }) {
  const { tasks, events, loading, addTask, moveTaskToDate, newEventOn } = usePlan();
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [mode, setMode] = useState("month");
  const [selectedDay, setSelectedDay] = useState(null);
  // Phones, month view: cells show dots, and the tapped day (today at first)
  // is listed under the grid instead of in a popup.
  const isPhone = useIsPhone();
  const inlineDay = isPhone && mode === "month";
  const [dayTaskName, setDayTaskName] = useState("");
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("calendarMode");
    if (["month", "week", "day"].includes(stored)) setMode(stored);
  }, []);

  function changeMode(next) {
    setMode(next);
    setSelectedDay(null);
    localStorage.setItem("calendarMode", next);
  }

  function shift(direction) {
    const d = calendarDate;
    if (mode === "month") setCalendarDate(new Date(d.getFullYear(), d.getMonth() + direction, 1));
    else setCalendarDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + (mode === "week" ? 7 : 1) * direction));
  }

  function openDay(dateStr) {
    setSelectedDay(dateStr);
    setDayTaskName("");
  }

  async function addTaskOnDay(e, dateStr) {
    e.preventDefault();
    if (!dayTaskName.trim() || !dateStr) return;
    await addTask({
      ...taskFieldsFromForm({ ...EMPTY_TASK_FORM, name: dayTaskName, dueDate: dateStr }),
      category: EMPTY_TASK_FORM.category,
      goal_id: null,
    });
    setDayTaskName("");
  }

  const drag = {
    onDragStart: (id) => (e) => {
      e.dataTransfer.effectAllowed = "move";
      setDraggedId(id);
    },
    onDragEnd: () => setDraggedId(null),
  };

  // Props for anything a task can be dropped onto to get `dateStr` (null clears it).
  function dropTarget(dateStr) {
    return {
      onDragOver: (e) => {
        if (!draggedId) return;
        e.preventDefault();
      },
      onDrop: (e) => {
        e.preventDefault();
        if (draggedId) moveTaskToDate(draggedId, dateStr);
        setDraggedId(null);
      },
    };
  }

  const tasksByDate = {};
  const undated = [];
  for (const t of visibleTasks) {
    if (!t.due_date) {
      // Finished undated tasks live in the list's Completed section, not here.
      if (t.status !== "Done") undated.push(t);
      continue;
    }
    (tasksByDate[t.due_date] ||= []).push(t);
  }
  for (const key of Object.keys(tasksByDate)) tasksByDate[key] = sortDoneLast(tasksByDate[key]);
  // Events on the days the grid shows (whole weeks around the month, which also
  // covers the Week and Day views), with repeats expanded onto their days.
  const grid = getMonthGrid(calendarDate.getFullYear(), calendarDate.getMonth());
  const eventsByDate = {};
  for (const ev of sortEvents(occurrencesBetween(events, toISODateLocal(grid[0].date), toISODateLocal(grid.at(-1).date)))) {
    (eventsByDate[ev.date] ||= []).push(ev);
  }

  const today = new Date();
  const weekDays = getWeekDays(calendarDate);
  const dayStr = toISODateLocal(calendarDate);
  const label =
    mode === "week"
      ? weekLabel(weekDays)
      : mode === "day"
        ? calendarDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
        : calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // A day's events and tasks at full size, plus add boxes for that date — the
  // Day view and the popup that opens when you click a day.
  function dayPanel(dateStr) {
    const dayTasks = tasksByDate[dateStr] || [];
    const dayEvents = eventsByDate[dateStr] || [];
    return (
      <div className="day-panel">
        {dayTasks.length === 0 && dayEvents.length === 0 && <p className="muted">Nothing on this day yet.</p>}
        {dayEvents.length > 0 && (
          <>
            <div className="section-heading events">
              <Icon name="clock" size={14} /> Events
            </div>
            {dayEvents.map((ev) => (
              <ListEvent key={ev.id} event={ev} />
            ))}
          </>
        )}
        {dayTasks.length > 0 && (
          <div className="section-heading tasks">
            <Icon name="checkCircle" size={14} /> Tasks
          </div>
        )}
        {dayTasks.map((t) => (
          <TaskRow key={t.id} task={t} showDue={false} stays />
        ))}
        <form className="day-panel-add" onSubmit={(e) => addTaskOnDay(e, dateStr)}>
          <input
            type="text"
            placeholder="Add a task on this day…"
            aria-label="New task name"
            value={dayTaskName}
            onChange={(e) => setDayTaskName(e.target.value)}
            autoFocus={!!selectedDay && !inlineDay}
          />
          <button type="submit" className="primary" disabled={!dayTaskName.trim()}>Add</button>
        </form>
        <button type="button" className="ghost small-btn day-panel-event-btn" onClick={() => newEventOn(dateStr)}>
          <Icon name="plus" size={13} /> Add an event on this day
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="calendar-wrap">
        <div className="card calendar-main">
          <div className="calendar-header">
            <div className="row" style={{ gap: 4 }}>
              <button className="ghost icon-btn" onClick={() => shift(-1)} aria-label={`Previous ${mode}`}>‹</button>
              <button className="ghost icon-btn" onClick={() => shift(1)} aria-label={`Next ${mode}`}>›</button>
              <span className="calendar-title">{label}</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="ghost new-event-btn" onClick={() => newEventOn(mode === "day" ? dayStr : toISODateLocal(new Date()))}>
                <Icon name="plus" size={13} /> Event
              </button>
              <button className="ghost" onClick={() => setCalendarDate(new Date())}>Today</button>
              <div className="segmented" role="group" aria-label="Calendar range">
                {["month", "week", "day"].map((m) => (
                  <button key={m} className={mode === m ? "active" : ""} aria-pressed={mode === m} onClick={() => changeMode(m)}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mode === "day" ? (
            <div className={`calendar-day ${draggedId ? "drop-target" : ""}`} {...dropTarget(dayStr)}>
              {dayPanel(dayStr)}
            </div>
          ) : mode === "month" ? (
            <div className="calendar-grid">
              {WEEKDAY_LABELS.map((w) => (
                <div className="calendar-weekday" key={w}>{w}</div>
              ))}
              {grid.map(({ date, outside }) => {
                const cellDate = toISODateLocal(date);
                // Events first, then tasks; past the limit, the last slot says "+N more".
                const items = [
                  ...(eventsByDate[cellDate] || []).map((ev) => <CalendarEventChip key={`e${ev.id}`} event={ev} />),
                  ...(tasksByDate[cellDate] || []).map((t) => (
                    <CalendarTaskChip key={`t${t.id}`} task={t} onDragStart={drag.onDragStart(t.id)} onDragEnd={drag.onDragEnd} />
                  )),
                ];
                const hidden = items.length - MONTH_CELL_LIMIT;
                const openTasks = (tasksByDate[cellDate] || []).filter((t) => t.status !== "Done").length;
                const eventCount = (eventsByDate[cellDate] || []).length;
                const selected = inlineDay && cellDate === (selectedDay || toISODateLocal(today));
                return (
                  <div
                    className={`calendar-cell ${outside ? "outside" : ""} ${isSameDay(date, today) ? "today" : ""} ${selected ? "selected" : ""} ${draggedId ? "drop-target" : ""}`}
                    key={cellDate}
                    onClick={() => openDay(cellDate)}
                    {...dropTarget(cellDate)}
                  >
                    <button
                      type="button"
                      className="calendar-date"
                      aria-label={`Open ${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
                    >
                      {date.getDate()}
                    </button>
                    {inlineDay ? (
                      <div className="calendar-dots" aria-label={`${eventCount} events, ${openTasks} open tasks`}>
                        {Array.from({ length: Math.min(eventCount, 3) }, (_, i) => (
                          <span key={`e${i}`} className="calendar-dot event" />
                        ))}
                        {Array.from({ length: Math.min(openTasks, 3) }, (_, i) => (
                          <span key={`t${i}`} className="calendar-dot task" />
                        ))}
                      </div>
                    ) : (
                      <div className="calendar-cell-tasks">
                        {items.slice(0, hidden > 0 ? MONTH_CELL_LIMIT - 1 : MONTH_CELL_LIMIT)}
                        {hidden > 0 && <span className="calendar-more">+{hidden + 1} more</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="calendar-week">
              {weekDays.map((date) => {
                const cellDate = toISODateLocal(date);
                return (
                  <div
                    className={`calendar-week-day ${isSameDay(date, today) ? "today" : ""} ${draggedId ? "drop-target" : ""}`}
                    key={cellDate}
                    {...dropTarget(cellDate)}
                  >
                    <button type="button" className="calendar-week-head" onClick={() => openDay(cellDate)}>
                      <span className="calendar-week-weekday">{WEEKDAY_LABELS[date.getDay()]}</span>
                      <span className="calendar-week-date">{date.getDate()}</span>
                    </button>
                    <div className="calendar-week-tasks">
                      {(eventsByDate[cellDate] || []).map((ev) => (
                        <WeekEvent key={ev.id} event={ev} />
                      ))}
                      {(tasksByDate[cellDate] || []).map((t) => (
                        <WeekTask key={t.id} task={t} onDragStart={drag.onDragStart(t.id)} onDragEnd={drag.onDragEnd} />
                      ))}
                      <button type="button" className="calendar-week-add" onClick={() => openDay(cellDate)}>
                        <Icon name="plus" size={13} /> Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {inlineDay && (
            <div className="calendar-phone-day">
              <h3 className="plan-day-label">
                {parseLocalDate(selectedDay || toISODateLocal(today)).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              {dayPanel(selectedDay || toISODateLocal(today))}
            </div>
          )}
          <div className="calendar-legend" aria-hidden="true">
            <span className="calendar-legend-item events">
              <span className="calendar-legend-swatch" /> Events
            </span>
            <span className="calendar-legend-item tasks">
              <span className="calendar-legend-check" /> Tasks
            </span>
          </div>
        </div>

        {/* The frame stretches to the calendar's height; the panel fills it and
            scrolls inside, so a long list never makes the row taller. */}
        <div className="calendar-side-frame">
        <div className="card calendar-side">
          <div className="calendar-side-section">
            <div className="section-label">Scheduled</div>
            <div className="calendar-side-list">
              {loading && <Skeleton rows={2} />}
              {!loading && agenda.length === 0 && (
                <div className="empty-state-mini">
                  <span className="empty-state-icon">✅</span>
                  <span>Nothing coming up.</span>
                </div>
              )}
              {agenda.map((day) => (
                <div className={`agenda-day ${day.key === "overdue" ? "overdue" : ""}`} key={day.key}>
                  <div className="agenda-day-label">{day.label}</div>
                  {day.events.map((ev) => (
                    <SideEventRow key={ev.id} event={ev} />
                  ))}
                  {day.tasks.map((t) => (
                    <SideTaskRow
                      key={t.id}
                      task={t}
                      showDate={day.key === "overdue"}
                      onDragStart={drag.onDragStart(t.id)}
                      onDragEnd={drag.onDragEnd}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="calendar-side-section">
            <div className="section-label">No date</div>
            <div className={`calendar-side-list ${draggedId ? "drop-target" : ""}`} {...dropTarget(null)}>
              {loading && <Skeleton rows={2} />}
              {!loading && undated.length === 0 && (
                <div className="empty-state-mini">
                  <span className="empty-state-icon">📭</span>
                  <span>Nothing here.</span>
                </div>
              )}
              {undated.map((t) => (
                <SideTaskRow key={t.id} task={t} onDragStart={drag.onDragStart(t.id)} onDragEnd={drag.onDragEnd} />
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>

      <Modal
        open={!!selectedDay && !dialogOpen && !inlineDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? parseLocalDate(selectedDay).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}
      >
        {selectedDay && dayPanel(selectedDay)}
      </Modal>
    </>
  );
}
