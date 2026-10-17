"use client";

import { useEffect, useState } from "react";
import EventModal from "../components/EventModal";
import Modal from "../components/Modal";
import Icon from "../components/Icon";
import TaskEditModal from "../components/TaskEditModal";
import PageTour from "../components/PageTour";
import { buildAgenda, groupTasksByDue } from "../../lib/taskGroups";
import { sortTasksList } from "../../lib/taskSort";
import { PlanContext } from "./PlanContext";
import { usePlanData } from "./usePlanData";
import AddBar from "./AddBar";
import FilterBar, { NO_FILTERS, activeFilterCount } from "./FilterBar";
import PlanList from "./PlanList";
import PlanCalendar from "./PlanCalendar";

// Plan: every task and event. The Add bar on top, then filters, then either
// the list (Scheduled beside No date) or the calendar.
export default function PlanPage() {
  const data = usePlanData();
  const [view, setView] = useState("list");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sortBy, setSortBy] = useState("due");
  // The dialogs: the task being edited, and { event } to edit one or { date } to add one.
  const [editingTask, setEditingTask] = useState(null);
  const [eventDialog, setEventDialog] = useState(null);
  // Phones: the Add bar lives in a sheet opened by the floating + button.
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("tasksView");
    if (stored === "list" || stored === "calendar") setView(stored);
  }, []);

  function changeView(next) {
    setView(next);
    localStorage.setItem("tasksView", next);
  }

  const filtersOn = activeFilterCount(filters) > 0;
  // A just-ticked task counts as open until its linger ends, so it stays put.
  const shownTasks = data.lingering.size
    ? data.tasks.map((t) => (data.lingering.has(t.id) ? { ...t, status: "To Do" } : t))
    : data.tasks;
  const visibleTasks = shownTasks.filter(
    (t) =>
      (filters.category === "All" || t.category === filters.category) &&
      (filters.status === "All" || t.status === filters.status) &&
      (filters.priority === "All" || t.priority === filters.priority) &&
      (filters.effort === "All" || t.effort === filters.effort)
  );
  const sortedTasks = sortTasksList(visibleTasks, sortBy);
  // Overdue, then each day with its events (next two weeks) and open tasks, in
  // the chosen sort order within a day. Filters are about tasks, so events
  // step aside while any filter is on.
  const agenda = buildAgenda(sortedTasks, filtersOn ? [] : data.events);
  const hiddenEventCount = filtersOn ? buildAgenda([], data.events).reduce((n, day) => n + day.events.length, 0) : 0;

  const plan = {
    ...data,
    openTask: setEditingTask,
    openEvent: (event) => setEventDialog({ event }),
    newEventOn: (date) => setEventDialog({ date }),
  };

  return (
    <PlanContext.Provider value={plan}>
      <div>
        <h1>Plan</h1>
        <p className="page-sub">Your tasks and events, all in one place.</p>

        <div className="plan-addbar-inline">
          <AddBar />
        </div>
        <button type="button" className="fab" onClick={() => setAddSheetOpen(true)} aria-label="Add a task or event">
          <Icon name="plus" size={24} />
        </button>
        <Modal open={addSheetOpen} onClose={() => setAddSheetOpen(false)} title="Add">
          <AddBar inSheet onAdded={() => setAddSheetOpen(false)} />
        </Modal>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          sortBy={sortBy}
          onSortChange={setSortBy}
          view={view}
          onViewChange={changeView}
        />

        {view === "list" ? (
          <PlanList
            agenda={agenda}
            taskGroups={groupTasksByDue(sortedTasks)}
            hiddenEventCount={hiddenEventCount}
            filtersOn={filtersOn}
            showDone={filters.status === "Done"}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        ) : (
          <PlanCalendar agenda={agenda} visibleTasks={visibleTasks} dialogOpen={!!editingTask || !!eventDialog} />
        )}

        <PageTour id="plan" ready={!data.loading} />
        <TaskEditModal
          task={editingTask}
          tasks={data.tasks}
          goals={data.goals}
          onClose={() => setEditingTask(null)}
          onSaved={data.loadData}
        />
        <EventModal
          open={!!eventDialog}
          event={eventDialog?.event}
          defaultDate={eventDialog?.date}
          onClose={() => setEventDialog(null)}
          onSaved={data.loadData}
        />
      </div>
    </PlanContext.Provider>
  );
}
