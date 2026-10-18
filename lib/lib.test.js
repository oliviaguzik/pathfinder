import { describe, expect, it, vi } from "vitest";

// goalCompletion imports the Supabase client, which needs env vars; the pure
// functions tested here never touch it.
vi.mock("./supabaseClient", () => ({ supabase: {} }));

import { daysFromToday, friendlyDate, getMonthGrid, isSameDay, parseLocalDate, quickDates, toISODateLocal } from "./dates";
import { agendaDayLabel, buildAgenda, groupCompleted, groupTasksByDue, isDueToday, isOverdue } from "./taskGroups";
import { sortDoneLast, sortTasksList } from "./taskSort";
import { parseQuickAdd } from "./parseQuickAdd";
import { splitHighlights } from "./highlight";
import { dueNotifications, leadLabel, localNow } from "./notifications";
import { getPeriod, goalsNeedingAttention, periodReport, shiftAnchor } from "./insights";
import { getWeekDays, weekLabel } from "./dates";
import {
  addRecurrenceInterval,
  nextOccurrence,
  presetFromRecurrence,
  recurrenceFromPreset,
  recurrenceLabel,
} from "./recurrence";
import { nextPosition, positionBetween, sortByPosition } from "./reorder";
import { computeGoalStatusPatch, computeGoalUncompletionPatch, goalStatusFor, isGoalFullyDone } from "./goalCompletion";
import { EMPTY_TASK_FORM, taskFieldsFromForm, taskFormFromTask } from "./taskForm";

const done = (extra = {}) => ({ status: "Done", ...extra });
const todo = (extra = {}) => ({ status: "To Do", ...extra });

describe("dates", () => {
  it("parses date-only strings as local midnight", () => {
    const d = parseLocalDate("2026-03-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 1, 0]);
  });

  it("round-trips through toISODateLocal", () => {
    expect(toISODateLocal(parseLocalDate("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("friendly dates", () => {
  const now = new Date(2026, 8, 27, 15, 30); // Sun Sep 27 2026, mid-afternoon

  it("counts calendar days regardless of the time of day", () => {
    expect(daysFromToday("2026-09-27", now)).toBe(0);
    expect(daysFromToday("2026-09-26", now)).toBe(-1);
    expect(daysFromToday("2026-11-02", now)).toBe(36); // across the DST change
  });

  it("uses relative words close to today", () => {
    expect(friendlyDate("2026-09-27", now)).toBe("Today");
    expect(friendlyDate("2026-09-28", now)).toBe("Tomorrow");
    expect(friendlyDate("2026-09-26", now)).toBe("Yesterday");
    expect(friendlyDate("2026-10-01", now)).toBe(parseLocalDate("2026-10-01").toLocaleDateString(undefined, { weekday: "long" }));
  });

  it("shows the year only when it differs", () => {
    expect(friendlyDate("2026-10-19", now)).not.toMatch(/2026/);
    expect(friendlyDate("2027-01-05", now)).toMatch(/2027/);
  });
});

describe("task groups", () => {
  it("buckets by due date and keeps order", () => {
    const now = new Date(2026, 8, 27);
    const tasks = [
      { id: "a", status: "To Do", due_date: "2026-09-30" },
      { id: "b", status: "To Do", due_date: "2026-09-20" },
      { id: "c", status: "To Do", due_date: null },
      { id: "d", status: "Done", due_date: "2026-09-20" },
      { id: "e", status: "To Do", due_date: "2026-09-27" },
      { id: "f", status: "To Do", due_date: "2026-09-28" },
    ];
    const ids = (list) => list.map((t) => t.id);
    const groups = groupTasksByDue(tasks, now);
    expect(ids(groups.overdue)).toEqual(["b"]);
    expect(ids(groups.today)).toEqual(["e"]);
    expect(ids(groups.upcoming)).toEqual(["a", "f"]);
    expect(ids(groups.noDate)).toEqual(["c"]);
    expect(ids(groups.completed)).toEqual(["d"]);
  });
});

describe("recurrence", () => {
  it("maps presets to units and back", () => {
    for (const preset of ["daily", "weekly", "monthly"]) {
      const { unit, interval } = recurrenceFromPreset(preset, "2");
      expect(presetFromRecurrence(unit, interval)).toBe(preset);
    }
  });

  it("treats custom as N days, never less than 1", () => {
    expect(recurrenceFromPreset("custom", "3")).toEqual({ unit: "day", interval: 3 });
    expect(recurrenceFromPreset("custom", "0")).toEqual({ unit: "day", interval: 1 });
    expect(recurrenceFromPreset("custom", "abc")).toEqual({ unit: "day", interval: 1 });
    expect(presetFromRecurrence("day", 3)).toBe("custom");
  });

  it("labels recurrences", () => {
    expect(recurrenceLabel({ recurrence_unit: "week", recurrence_interval: 1 })).toBe("Repeats every week");
    expect(recurrenceLabel({ recurrence_unit: "day", recurrence_interval: 3 })).toBe("Repeats every 3 days");
  });

  it("adds days, weeks and months across boundaries", () => {
    const iso = (d) => toISODateLocal(d);
    expect(iso(addRecurrenceInterval(parseLocalDate("2026-12-31"), "day", 1))).toBe("2027-01-01");
    expect(iso(addRecurrenceInterval(parseLocalDate("2026-02-25"), "week", 1))).toBe("2026-03-04");
    expect(iso(addRecurrenceInterval(parseLocalDate("2026-11-15"), "month", 2))).toBe("2027-01-15");
  });

  it("builds the next occurrence from the due date", () => {
    const task = {
      name: "Water plants",
      category: "General Life",
      goal_id: null,
      priority: "Low",
      effort: "Small",
      due_date: "2026-09-27",
      status: "Done",
      recurring: true,
      recurrence_unit: "week",
      recurrence_interval: 1,
    };
    expect(nextOccurrence(task, toISODateLocal, parseLocalDate)).toEqual({
      ...task,
      due_date: "2026-10-04",
      status: "To Do",
    });
  });
});

describe("reorder", () => {
  it("places items between, before or after neighbours", () => {
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(undefined, 2)).toBe(1);
    expect(positionBetween(5, null)).toBe(6);
    expect(positionBetween(null, undefined)).toBe(1);
  });

  it("appends after the highest position", () => {
    expect(nextPosition([{ position: 3 }, { position: null }, { position: 7 }])).toBe(8);
    expect(nextPosition([])).toBe(1);
  });

  it("sorts by position with unpositioned items last", () => {
    const sorted = sortByPosition([{ id: "a" }, { id: "b", position: 2 }, { id: "c", position: 1 }]);
    expect(sorted.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});

describe("goal status", () => {
  it("mirrors the goal card", () => {
    expect(goalStatusFor({}, [])).toBe("Not Started");
    expect(goalStatusFor({}, [todo(), todo()])).toBe("Not Started");
    expect(goalStatusFor({}, [todo(), done()])).toBe("In Progress");
    expect(goalStatusFor({}, [done()])).toBe("In Progress");
    expect(goalStatusFor({ completed_at: "2026-09-01" }, [done()])).toBe("Completed");
  });

  it("only patches when the status changed", () => {
    expect(computeGoalStatusPatch({ status: "Not Started" }, [todo()])).toBeNull();
    expect(computeGoalStatusPatch({ status: "Not Started" }, [done()])).toEqual({ status: "In Progress" });
    expect(computeGoalStatusPatch(undefined, [done()])).toBeNull();
  });

  it("reopens a finished goal only when it gains an unfinished task", () => {
    const finished = { completed_at: "2026-09-01", status: "Completed" };
    expect(computeGoalUncompletionPatch(finished, [done(), done()])).toBeNull();
    expect(computeGoalUncompletionPatch(finished, [])).toBeNull();
    expect(computeGoalUncompletionPatch(finished, [done(), todo()])).toEqual({ completed_at: null, status: "In Progress" });
    expect(computeGoalUncompletionPatch(finished, [todo()])).toEqual({ completed_at: null, status: "Not Started" });
    expect(computeGoalUncompletionPatch({ completed_at: null }, [todo()])).toBeNull();
  });

  it("is fully done only with at least one task, all done", () => {
    expect(isGoalFullyDone([])).toBe(false);
    expect(isGoalFullyDone([done(), todo()])).toBe(false);
    expect(isGoalFullyDone([done(), done()])).toBe(true);
  });
});

describe("task form", () => {
  it("round-trips a task through the form", () => {
    const task = {
      name: "Stretch",
      category: "Goal-Related",
      goal_id: "g1",
      priority: "High",
      effort: null,
      due_date: "2026-10-01",
      recurring: true,
      recurrence_unit: "day",
      recurrence_interval: 3,
    };
    const form = taskFormFromTask(task);
    expect(form).toMatchObject({ goalId: "g1", effort: "", recurrencePreset: "custom", recurrenceCustomDays: "3" });
    expect(taskFieldsFromForm(form)).toEqual({
      name: "Stretch",
      priority: "High",
      effort: null,
      due_date: "2026-10-01",
      recurring: true,
      recurrence_unit: "day",
      recurrence_interval: 3,
    });
  });

  it("clears recurrence columns for non-recurring tasks", () => {
    expect(taskFieldsFromForm({ ...EMPTY_TASK_FORM, name: "x" })).toMatchObject({
      recurring: false,
      recurrence_unit: null,
      recurrence_interval: 1,
      priority: null,
      due_date: null,
    });
  });
});

describe("weeks", () => {
  it("starts on Sunday and labels ranges", () => {
    const days = getWeekDays(new Date(2026, 9, 1)); // Thu Oct 1
    expect(toISODateLocal(days[0])).toBe("2026-09-27");
    expect(toISODateLocal(days[6])).toBe("2026-10-03");
    expect(weekLabel(getWeekDays(new Date(2026, 9, 20)))).toMatch(/18 – 24, 2026/);
  });
});

describe("insights", () => {
  const now = new Date(2026, 8, 27, 12); // Sun Sep 27 2026
  const at = (y, m, d) => new Date(y, m, d, 10).toISOString();

  it("flags goals that need a nudge, most pressing first", () => {
    const goals = [
      { id: "fine", created_at: at(2026, 8, 1) },
      { id: "stale", created_at: at(2026, 8, 1) },
      { id: "empty", created_at: at(2026, 8, 25) },
      { id: "late", created_at: at(2026, 8, 1), target_date: "2026-09-20" },
      { id: "ready", created_at: at(2026, 8, 1) },
      { id: "done", created_at: at(2026, 8, 1), completed_at: at(2026, 8, 20) },
      { id: "paused", created_at: at(2026, 8, 1), paused_at: at(2026, 8, 5) },
    ];
    const tasks = [
      { goal_id: "fine", status: "Done", completed_at: at(2026, 8, 25) },
      { goal_id: "fine", status: "To Do" },
      { goal_id: "stale", status: "Done", completed_at: at(2026, 8, 10) },
      { goal_id: "stale", status: "To Do" },
      { goal_id: "late", status: "To Do" },
      { goal_id: "ready", status: "Done", completed_at: at(2026, 8, 26) },
    ];
    const flags = goalsNeedingAttention(goals, tasks, now).map((a) => [a.goal.id, a.kind]);
    expect(flags).toEqual([
      ["late", "overdue"],
      ["empty", "no-next-step"],
      ["stale", "stale"],
      ["ready", "ready"],
    ]);
  });

  it("counts completions per day within the week only", () => {
    const period = getPeriod("week", now);
    const tasks = [
      { id: "a", status: "Done", completed_at: at(2026, 8, 27) },
      { id: "b", status: "Done", completed_at: at(2026, 8, 29) },
      { id: "c", status: "Done", completed_at: at(2026, 8, 29) },
      { id: "d", status: "Done", completed_at: at(2026, 8, 26) }, // previous week
      { id: "e", status: "Done", completed_at: null }, // finished before tracking
      { id: "f", status: "To Do", completed_at: at(2026, 8, 28) }, // unchecked again
    ];
    const goals = [{ id: "g", completed_at: at(2026, 9, 1) }];
    const report = periodReport(tasks, goals, period);
    expect(report.perBucket.map((d) => d.count)).toEqual([1, 0, 2, 0, 0, 0, 0]);
    expect(report.completed.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
    expect(report.goalsFinished).toHaveLength(1);
  });

  it("builds month and year periods", () => {
    const month = getPeriod("month", new Date(2026, 1, 10));
    expect(month.buckets).toHaveLength(28);
    expect(toISODateLocal(month.start)).toBe("2026-02-01");
    expect(toISODateLocal(month.end)).toBe("2026-03-01");
    const year = getPeriod("year", new Date(2026, 5, 1));
    expect(year.buckets).toHaveLength(12);
    const tasks = [
      { status: "Done", completed_at: at(2026, 0, 31) },
      { status: "Done", completed_at: at(2026, 11, 31) },
      { status: "Done", completed_at: at(2027, 0, 1) },
    ];
    expect(periodReport(tasks, [], year).perBucket.map((b) => b.count)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("steps periods back and forward", () => {
    expect(toISODateLocal(shiftAnchor("month", new Date(2026, 0, 31), -1))).toBe("2025-12-01");
    expect(toISODateLocal(shiftAnchor("week", new Date(2026, 8, 27), 1))).toBe("2026-10-04");
    expect(shiftAnchor("year", new Date(2026, 8, 27), -1).getFullYear()).toBe(2025);
  });
});

describe("completed groups", () => {
  it("groups by when a task was finished, newest first", () => {
    const now = new Date(2026, 9, 1, 12); // Thu Oct 1; week starts Sun Sep 27
    const at = (m, d, h = 10) => new Date(2026, m, d, h).toISOString();
    const tasks = [
      { id: "old", completed_at: at(8, 20) },
      { id: "untracked", completed_at: null, created_at: at(8, 1) },
      { id: "today-early", completed_at: at(9, 1, 8) },
      { id: "today-late", completed_at: at(9, 1, 11) },
      { id: "yesterday", completed_at: at(8, 30) },
      { id: "sunday", completed_at: at(8, 27) },
    ];
    const groups = Object.fromEntries(groupCompleted(tasks, now).map((g) => [g.key, g.tasks.map((t) => t.id)]));
    expect(groups).toEqual({
      today: ["today-late", "today-early"],
      yesterday: ["yesterday"],
      week: ["sunday"],
      older: ["old", "untracked"],
    });
  });
});

import { EMPTY_EVENT_FORM, eventFieldsFromForm, eventFormFromEvent, eventTimeLabel, formatTime, newEventForm, occurrencesBetween, repeatLabel, sortEvents } from "./events";

describe("events", () => {
  it("formats times and labels", () => {
    expect(formatTime("15:30:00")).toBe(new Date(2000, 0, 1, 15, 30).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
    expect(eventTimeLabel({ all_day: true })).toBe("All day");
    expect(eventTimeLabel({ start_time: "09:00:00", end_time: "10:00:00" })).toContain("–");
    expect(eventTimeLabel({ start_time: "09:00:00" })).not.toContain("–");
  });

  it("sorts all-day first, then by start time", () => {
    const sorted = sortEvents([
      { id: "late", start_time: "18:00:00" },
      { id: "allday", all_day: true },
      { id: "early", start_time: "08:30:00" },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["allday", "early", "late"]);
  });

  it("validates and maps the form", () => {
    const base = { ...EMPTY_EVENT_FORM, title: " Dentist ", date: "2026-09-30" };
    expect(eventFieldsFromForm({ ...base, title: "" }).error).toMatch(/name/);
    expect(eventFieldsFromForm({ ...base, date: "" }).error).toMatch(/date/);
    expect(eventFieldsFromForm({ ...base, startTime: "10:00", endTime: "09:00" }).error).toMatch(/after/);
    expect(eventFieldsFromForm(base).fields).toEqual({
      title: "Dentist",
      date: "2026-09-30",
      all_day: false,
      start_time: "09:00",
      end_time: "10:00",
      location: null,
      notes: null,
    });
    expect(eventFieldsFromForm({ ...base, allDay: true }).fields).toMatchObject({ all_day: true, start_time: null, end_time: null });
    const event = { title: "Dinner", date: "2026-10-01", all_day: false, start_time: "19:30:00", end_time: null, location: "Nonna's", notes: null };
    expect(eventFormFromEvent(event)).toMatchObject({ startTime: "19:30", endTime: "", location: "Nonna's" });
  });
});

describe("new event defaults", () => {
  it("starts at the next full hour, today unless a date is given", () => {
    const now = new Date(2026, 8, 30, 14, 25);
    expect(newEventForm(undefined, now)).toMatchObject({ date: "2026-09-30", startTime: "15:00", endTime: "16:00" });
    expect(newEventForm("2026-10-02", now).date).toBe("2026-10-02");
    expect(newEventForm(undefined, new Date(2026, 8, 30, 23, 10))).toMatchObject({ startTime: "23:00", endTime: "" });
  });
});

describe("events alongside tasks", () => {
  const now = new Date(2026, 9, 17, 9, 0);
  const ev = (id, date, start_time = "17:00:00", all_day = false) => ({ id, title: id, date, start_time, all_day });
  const task = (id, due_date, status = "To Do") => ({ id, due_date, status });

  it("labels agenda days", () => {
    expect(agendaDayLabel("2026-10-17", now)).toBe("Today");
    expect(agendaDayLabel("2026-10-18", now)).toBe("Tomorrow");
    expect(agendaDayLabel("2026-10-20", now)).not.toMatch(/2026/);
    expect(agendaDayLabel("2027-01-05", now)).toMatch(/2027/);
  });

  it("builds an agenda: overdue, then days with events before tasks", () => {
    const agenda = buildAgenda(
      [task("old", "2026-10-10"), task("done", "2026-10-18", "Done"), task("t1", "2026-10-18"), task("later", "2026-12-01"), task("nodate", null)],
      [ev("e1", "2026-10-18"), ev("e0", "2026-10-17"), ev("gone", "2026-10-15"), ev("far", "2026-12-20")],
      now
    );
    expect(agenda.map((s) => s.label.length > 0 && s.key)).toEqual(["overdue", "2026-10-17", "2026-10-18", "2026-12-01"]);
    expect(agenda[0].tasks.map((t) => t.id)).toEqual(["old"]);
    expect(agenda[2]).toMatchObject({ label: "Tomorrow" });
    expect(agenda[2].events.map((e) => e.id)).toEqual(["e1"]);
    expect(agenda[2].tasks.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("quickDates", () => {
  it("gives today, tomorrow and next Monday", () => {
    // Saturday Oct 17, 2026
    expect(quickDates(new Date(2026, 9, 17, 10))).toEqual({ today: "2026-10-17", tomorrow: "2026-10-18", nextWeek: "2026-10-19" });
    // On a Monday, next week is the following Monday
    expect(quickDates(new Date(2026, 9, 19, 10)).nextWeek).toBe("2026-10-26");
    // Sunday -> the next day is Monday
    expect(quickDates(new Date(2026, 9, 18, 10)).nextWeek).toBe("2026-10-19");
  });
});

describe("month grid", () => {
  it("fills whole weeks around the month", () => {
    const cells = getMonthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(cells.length % 7).toBe(0);
    expect(toISODateLocal(cells[0].date)).toBe("2026-09-27");
    expect(cells[0].outside).toBe(true);
    expect(cells.find((c) => !c.outside).date.getDate()).toBe(1);
    expect(toISODateLocal(cells.at(-1).date)).toBe("2026-10-31");
    expect(isSameDay(new Date(2026, 9, 17, 8), new Date(2026, 9, 17, 22))).toBe(true);
  });
});

describe("task sorting and due state", () => {
  const now = new Date(2026, 9, 17, 9);
  it("sorts by due date with undated last and done tasks at the bottom", () => {
    const list = [
      { id: "a", status: "Done", due_date: "2026-10-01" },
      { id: "b", status: "To Do", due_date: null },
      { id: "c", status: "To Do", due_date: "2026-10-20" },
      { id: "d", status: "To Do", due_date: "2026-10-18" },
    ];
    expect(sortTasksList(list, "due").map((t) => t.id)).toEqual(["d", "c", "b", "a"]);
    expect(sortDoneLast(list).map((t) => t.id)).toEqual(["b", "c", "d", "a"]);
  });
  it("knows overdue and due today", () => {
    expect(isOverdue({ due_date: "2026-10-16", status: "To Do" }, now)).toBe(true);
    expect(isOverdue({ due_date: "2026-10-16", status: "Done" }, now)).toBe(false);
    expect(isDueToday({ due_date: "2026-10-17", status: "To Do" }, now)).toBe(true);
    expect(isOverdue({ due_date: null, status: "To Do" }, now)).toBe(false);
  });
});

describe("parseQuickAdd", () => {
  // Saturday, October 17, 2026, 10am
  const now = new Date(2026, 9, 17, 10);
  const p = (text, withTime = false) => parseQuickAdd(text, { now, withTime });

  it("reads relative days", () => {
    expect(p("Call mom tomorrow")).toMatchObject({ title: "Call mom", date: "2026-10-18", phrase: "tomorrow" });
    expect(p("Pay bill today")).toMatchObject({ title: "Pay bill", date: "2026-10-17" });
    expect(p("Renew passport in 2 weeks").date).toBe("2026-10-31");
    expect(p("Check in a day").date).toBe("2026-10-18");
    expect(p("Plan trip next week").date).toBe("2026-10-19");
  });

  it("reads weekdays (the coming one; next = a week later)", () => {
    expect(p("Dentist fri")).toMatchObject({ title: "Dentist", date: "2026-10-23" });
    expect(p("Gym on monday").date).toBe("2026-10-19");
    expect(p("Review next friday").date).toBe("2026-10-30");
    expect(p("Clean saturday").date).toBe("2026-10-17");
    expect(p("Buy sun cream").date).toBe(null);
  });

  it("reads month days, rolling to next year when passed", () => {
    expect(p("Taxes oct 20")).toMatchObject({ title: "Taxes", date: "2026-10-20" });
    expect(p("Party December 3rd").date).toBe("2026-12-03");
    expect(p("Dentist 5 jan").date).toBe("2027-01-05");
    expect(p("Visit 20th of November").date).toBe("2026-11-20");
    expect(p("Old thing oct 1").date).toBe("2027-10-01");
    expect(p("Pay taxes due 10/30")).toMatchObject({ title: "Pay taxes", date: "2026-10-30" });
    expect(p("Form 2/30").date).toBe(null);
  });

  it("reads ordinals as this month or next", () => {
    expect(p("Pay rent on the 1st")).toMatchObject({ title: "Pay rent", date: "2026-11-01" });
    expect(p("Call the 20th").date).toBe("2026-10-20");
    expect(parseQuickAdd("Rent the 5th", { now: new Date(2026, 11, 20) }).date).toBe("2027-01-05");
  });

  it("reads times only for events", () => {
    expect(p("Dentist fri 3pm")).toMatchObject({ title: "Dentist 3pm", date: "2026-10-23", startTime: null });
    expect(p("Dentist fri 3pm", true)).toMatchObject({ title: "Dentist", date: "2026-10-23", startTime: "15:00", endTime: null });
    expect(p("Lunch tomorrow at noon", true)).toMatchObject({ title: "Lunch", startTime: "12:00" });
    expect(p("Call 3-4pm", true)).toMatchObject({ title: "Call", startTime: "15:00", endTime: "16:00" });
    expect(p("Class 10:30-11am", true)).toMatchObject({ startTime: "10:30", endTime: "11:00" });
    expect(p("Late 11-1pm", true)).toMatchObject({ startTime: "11:00", endTime: "13:00" });
    expect(p("Standup at 9", true).startTime).toBe("09:00");
    expect(p("Drinks at 6", true).startTime).toBe("18:00");
    expect(p("Train 17:45", true).startTime).toBe("17:45");
  });

  it("lists the understood words as typed, for highlighting", () => {
    expect(p("Dentist Fri 3pm", true).phrases).toEqual(["Fri", "3pm"]);
    expect(p("Read chapter 3").phrases).toEqual([]);
  });

  it("understands the examples shown in the app", () => {
    expect(p("Call mom tomorrow").date).toBe("2026-10-18");
    expect(p("Dentist fri").date).toBe("2026-10-23");
    expect(p("Taxes oct 20").date).toBe("2026-10-20");
    expect(p("Dinner fri 7pm", true)).toMatchObject({ title: "Dinner", date: "2026-10-23", startTime: "19:00" });
    expect(p("Lunch tomorrow at noon", true)).toMatchObject({ title: "Lunch", date: "2026-10-18", startTime: "12:00" });
    expect(p("Call oct 20 3-4pm", true)).toMatchObject({ title: "Call", date: "2026-10-20", startTime: "15:00", endTime: "16:00" });
  });

  it("leaves plain text alone", () => {
    expect(p("Read chapter 3")).toMatchObject({ title: "Read chapter 3", date: null, phrase: "" });
    expect(p("Wedding gift")).toMatchObject({ date: null });
    expect(p("tomorrow")).toMatchObject({ title: "tomorrow", date: null });
  });
});

describe("splitHighlights", () => {
  it("marks each understood phrase where it was typed", () => {
    expect(splitHighlights("Dentist Fri 3pm", ["Fri", "3pm"])).toEqual([
      { text: "Dentist ", hit: false },
      { text: "Fri", hit: true },
      { text: " ", hit: false },
      { text: "3pm", hit: true },
    ]);
    expect(splitHighlights("Call mom", [])).toEqual([{ text: "Call mom", hit: false }]);
    expect(splitHighlights("fri fri", ["fri"])).toEqual([{ text: "fri", hit: true }, { text: " fri", hit: false }]);
  });
});

describe("repeating events", () => {
  const weekly = { id: "yoga", title: "Yoga", date: "2026-10-05", recurrence_unit: "week", recurrence_interval: 1, skip_dates: [] };
  const days = (list) => list.map((e) => e.date);

  it("expands a weekly event into the days it happens", () => {
    expect(days(occurrencesBetween([weekly], "2026-10-01", "2026-10-31"))).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    const later = occurrencesBetween([weekly], "2026-10-13", "2026-10-20");
    expect(later).toEqual([{ ...weekly, date: "2026-10-19", seriesDate: "2026-10-05" }]);
  });

  it("starts no earlier than its first date, and stops at Until and skipped days", () => {
    expect(days(occurrencesBetween([weekly], "2026-09-01", "2026-10-06"))).toEqual(["2026-10-05"]);
    const limited = { ...weekly, repeat_until: "2026-10-19", skip_dates: ["2026-10-12"] };
    expect(days(occurrencesBetween([limited], "2026-10-01", "2026-12-31"))).toEqual(["2026-10-05", "2026-10-19"]);
  });

  it("handles every N days and months (skipping months without the day)", () => {
    const every3 = { ...weekly, recurrence_unit: "day", recurrence_interval: 3 };
    expect(days(occurrencesBetween([every3], "2026-10-10", "2026-10-20"))).toEqual(["2026-10-11", "2026-10-14", "2026-10-17", "2026-10-20"]);
    const monthly = { ...weekly, date: "2026-08-31", recurrence_unit: "month" };
    expect(days(occurrencesBetween([monthly], "2026-08-01", "2027-01-31"))).toEqual(["2026-08-31", "2026-10-31", "2026-12-31", "2027-01-31"]);
  });

  it("keeps one-off events in range as they are", () => {
    const once = { id: "x", date: "2026-10-18" };
    expect(occurrencesBetween([once], "2026-10-01", "2026-10-31")).toEqual([once]);
    expect(occurrencesBetween([once], "2026-11-01", "2026-11-30")).toEqual([]);
  });

  it("maps repeats to and from the form", () => {
    const base = { ...EMPTY_EVENT_FORM, title: "Yoga", date: "2026-10-05", repeats: true, recurrencePreset: "weekly", repeatUntil: "2026-12-01" };
    expect(eventFieldsFromForm(base).fields).toMatchObject({ recurrence_unit: "week", recurrence_interval: 1, repeat_until: "2026-12-01" });
    expect(eventFieldsFromForm({ ...base, repeatUntil: "2026-10-01" }).error).toMatch(/Until/);
    // Stopping a repeat clears it; a one-off never sends repeat columns.
    expect(eventFieldsFromForm({ ...base, repeats: false, wasRepeating: true }).fields).toMatchObject({ recurrence_unit: null });
    expect(eventFieldsFromForm({ ...base, repeats: false }).fields).not.toHaveProperty("recurrence_unit");
    // A repeat opened on a later day edits the series from its first date.
    const form = eventFormFromEvent({ ...weekly, date: "2026-10-19", seriesDate: "2026-10-05", start_time: "18:00:00" });
    expect(form).toMatchObject({ date: "2026-10-05", repeats: true, recurrencePreset: "weekly", wasRepeating: true });
    expect(repeatLabel(weekly)).toBe("Every week");
    expect(repeatLabel({ recurrence_unit: "day", recurrence_interval: 3 })).toBe("Every 3 days");
  });
});

describe("notifications", () => {
  const tz = "America/Chicago"; // UTC-5 in October
  // Saturday Oct 17, 2026, 4:46 PM in Chicago
  const at = (h, m, day = 17) => new Date(Date.UTC(2026, 9, day, h + 5, m));
  const settings = { event_lead_minutes: 15, morning_summary_time: "08:00:00", overdue_nudge_time: "19:00:00" };
  const haircut = { id: "h", title: "Haircut", date: "2026-10-17", start_time: "17:00:00", location: "Main St", all_day: false };
  const run = (now, extra = {}) =>
    dueNotifications({ now, timeZone: tz, settings, events: [haircut], tasks: [], sent: new Set(), ...extra });

  it("reads the wall clock in the person's time zone", () => {
    expect(localNow(at(16, 46), tz)).toMatchObject({ date: "2026-10-17", time: "16:46" });
    expect(localNow(at(23, 30), tz).date).toBe("2026-10-17");
  });

  it("reminds before events, once, within a short window", () => {
    expect(run(at(16, 44))).toEqual([]);
    const due = run(at(16, 46));
    expect(due).toEqual([{ kind: "event", ref: "h:2026-10-17", title: "Haircut", body: "In 15 min · 5:00 PM · Main St", url: "/" }]);
    expect(run(at(16, 46), { sent: new Set(["event:h:2026-10-17"]) })).toEqual([]);
    expect(run(at(17, 5))).toEqual([]);
  });

  it("uses an event's own reminder, or none", () => {
    expect(run(at(16, 0), { events: [{ ...haircut, reminder_minutes: 60 }] })[0].body).toMatch(/In 1 hour/);
    expect(run(at(16, 46), { events: [{ ...haircut, reminder_minutes: -1 }] })).toEqual([]);
    expect(run(at(17, 0), { events: [{ ...haircut, reminder_minutes: 0 }] })[0].body).toMatch(/Starting now/);
    expect(run(at(16, 46), { settings: { ...settings, event_lead_minutes: null } })).toEqual([]);
  });

  it("reminds before each day of a repeating event", () => {
    const weekly = { ...haircut, id: "y", title: "Yoga", date: "2026-10-05", start_time: "18:00:00", recurrence_unit: "week", recurrence_interval: 1 };
    const due = dueNotifications({ now: at(17, 50, 19), timeZone: tz, settings, events: [weekly], tasks: [], sent: new Set() });
    expect(due.map((n) => n.ref)).toEqual(["y:2026-10-19"]);
  });

  it("sends a morning summary when there's something on", () => {
    const tasks = [
      { id: "a", status: "To Do", due_date: "2026-10-17" },
      { id: "b", status: "To Do", due_date: "2026-09-28" },
      { id: "c", status: "Done", due_date: "2026-10-17" },
    ];
    const due = run(at(8, 3), { tasks });
    expect(due).toEqual([{ kind: "summary", ref: "2026-10-17", title: "Your day", body: "1 event · 1 task due · 1 overdue", url: "/" }]);
    expect(run(at(7, 59), { tasks })).toEqual([]);
    expect(run(at(8, 3), { events: [], tasks: [] })).toEqual([]);
  });

  it("nudges about overdue tasks in the evening", () => {
    const tasks = [{ id: "b", status: "To Do", due_date: "2026-09-28" }];
    expect(run(at(19, 2), { events: [], tasks })).toEqual([
      { kind: "overdue", ref: "2026-10-17", title: "Overdue tasks", body: "1 task is overdue. Give it a new date?", url: "/plan" },
    ]);
    expect(run(at(19, 2), { events: [], tasks: [] })).toEqual([]);
  });

  it("sends task reminders at their moment", () => {
    const remind_at = new Date(Date.UTC(2026, 9, 17, 19, 0)).toISOString(); // 2:00 PM Chicago
    const tasks = [{ id: "t", name: "Call the bank", status: "To Do", remind_at }];
    expect(run(at(13, 59), { events: [], tasks })).toEqual([]);
    expect(run(at(14, 1), { events: [], tasks })).toEqual([
      { kind: "task", ref: `t:${remind_at}`, title: "Reminder", body: "Call the bank", url: "/plan" },
    ]);
    expect(run(at(14, 1), { events: [], tasks: [{ ...tasks[0], status: "Done" }] })).toEqual([]);
  });

  it("labels lead times", () => {
    expect([5, 60, 120, 1440].map(leadLabel)).toEqual(["5 min", "1 hour", "2 hours", "1 day"]);
  });
});

describe("reminder fields", () => {
  it("adds a task reminder only when one is set (or removed)", () => {
    expect(taskFieldsFromForm({ ...EMPTY_TASK_FORM, name: "x" })).not.toHaveProperty("remind_at");
    const local = "2026-10-20T14:00";
    expect(taskFieldsFromForm({ ...EMPTY_TASK_FORM, name: "x", remindAt: local }).remind_at).toBe(new Date(local).toISOString());
    expect(taskFieldsFromForm({ ...EMPTY_TASK_FORM, name: "x", hadReminder: true }).remind_at).toBe(null);
    const form = taskFormFromTask({ name: "x", category: "General Life", remind_at: new Date(local).toISOString() });
    expect(form).toMatchObject({ remindAt: local, hadReminder: true });
  });

  it("adds an event's own reminder only when one is chosen (or cleared)", () => {
    const base = { ...EMPTY_EVENT_FORM, title: "Dentist", date: "2026-10-20" };
    expect(eventFieldsFromForm(base).fields).not.toHaveProperty("reminder_minutes");
    expect(eventFieldsFromForm({ ...base, reminderMinutes: "60" }).fields.reminder_minutes).toBe(60);
    expect(eventFieldsFromForm({ ...base, reminderMinutes: "-1" }).fields.reminder_minutes).toBe(-1);
    expect(eventFieldsFromForm({ ...base, hadReminder: true }).fields.reminder_minutes).toBe(null);
    expect(eventFormFromEvent({ title: "D", date: "2026-10-20", reminder_minutes: 30 })).toMatchObject({ reminderMinutes: "30", hadReminder: true });
  });
});
