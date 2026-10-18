// The steps of each page's first-visit tour. `target` is a list of places to
// point at (the first one visible on screen is used; a step with none visible
// is skipped). `phoneBody` replaces `body` on phones.
export const TOURS = {
  today: [
    {
      target: ".addbar-inline .quick-add, .fab",
      title: "Add anything",
      body: "Add a task or an event from here or from Plan; it's the same box. A task with no date typed is due today.",
      phoneBody: "Tap + to add a task or event, here or on Plan. A task with no date typed is due today.",
    },
    {
      target: ".today-card",
      title: "Your day in one place",
      body: "Star up to 3 tasks to focus on. Today's events and anything due or overdue sit below. Tick a task when it's done; you can always Undo.",
    },
    {
      target: ".main-goal-line",
      title: "Your main goal",
      body: "The goal you starred on the Goals page, with its next step. Add that step to today's focus in one click.",
    },
    {
      target: ".tabbar, .navlinks",
      title: "Getting around",
      body: "Plan has every task and event. Goals tracks the bigger things. Review shows what you got done.",
    },
  ],
  plan: [
    {
      target: ".addbar-inline .quick-add, .fab",
      title: "Add anything",
      body: "Switch between Task and Event, then type. Dates and times in plain words, like “Dentist fri 3pm”, are filled in for you. The ⓘ shows more examples.",
      phoneBody: "Tap + to add a task or event. Dates and times in plain words, like “Dentist fri 3pm”, are filled in for you.",
    },
    {
      target: ".plan-scheduled, .calendar-main",
      title: "Your plan, day by day",
      body: "Overdue first, then each day's events and tasks. Click anything to open it, or drag a task onto another day.",
      phoneBody: "Overdue first, then each day's events and tasks. Tap anything to open it.",
    },
    {
      target: ".plan-undated, .calendar-side",
      title: "No date yet",
      body: "Tasks without a date wait here. Drag one onto a day when you're ready.",
      phoneBody: "Tasks without a date wait here until you give them one.",
    },
    {
      target: "[aria-label='Calendar view']",
      title: "List or calendar",
      body: "Switch to a calendar with Month, Week and Day views.",
    },
  ],
  goals: [
    {
      target: ".goal-tile-full, .goal-list-row-full, .add-goal-btn",
      title: "Your goals",
      body: "Each goal's ring fills as its tasks get done. Star ☆ one as your main goal and it shows on Today.",
    },
    {
      target: ".tile-tasks-header button, .add-goal-btn",
      title: "Steps toward a goal",
      body: "Add the tasks that move a goal forward. Dates in plain words work here too.",
    },
  ],
  review: [
    {
      target: ".summary-strip",
      title: "How it's going",
      body: "What you finished this week, month or year, and how it compares with the one before.",
    },
    {
      target: ".review-columns",
      title: "Goals and finished tasks",
      body: "Which goals moved forward, and everything you checked off in this period. Click a task to open it.",
    },
    {
      target: ".review-decisions",
      title: "Keep things current",
      body: "Overdue tasks collect here. Click a date to give it a realistic new one.",
    },
  ],
};
