import { describe, expect, it, vi } from "vitest";

// goalCompletion imports the Supabase client, which needs env vars; the pure
// functions tested here never touch it.
vi.mock("./supabaseClient", () => ({ supabase: {} }));

import { daysFromToday, friendlyDate, parseLocalDate, toISODateLocal } from "./dates";
import { groupCompleted, groupTasksByDue } from "./taskGroups";
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

import { EMPTY_EVENT_FORM, eventFieldsFromForm, eventFormFromEvent, eventTimeLabel, formatTime, newEventForm, sortEvents } from "./events";

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
