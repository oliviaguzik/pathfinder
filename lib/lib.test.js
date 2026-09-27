import { describe, expect, it, vi } from "vitest";

// goalCompletion imports the Supabase client, which needs env vars; the pure
// functions tested here never touch it.
vi.mock("./supabaseClient", () => ({ supabase: {} }));

import { daysFromToday, friendlyDate, parseLocalDate, toISODateLocal } from "./dates";
import { groupTasksByDue } from "./taskGroups";
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
