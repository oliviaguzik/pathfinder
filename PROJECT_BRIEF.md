# Project brief: Task & Goal Tracker (PathFinder)

## What this is
A personal web app replacing a Notion-based task/goal tracker. It's a
Next.js app with a Supabase (Postgres) backend, deployed on Vercel.

## Tech stack
- Next.js (App Router, JavaScript, no TypeScript)
- Supabase for the database (Postgres) and auth — connected via
  `@supabase/supabase-js` in `lib/supabaseClient.js`, using env vars
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Google sign-in via Supabase Auth (`lib/AuthProvider.js`), gating the whole
  app behind `app/components/AuthGate.js` / `LoginScreen.js`
- Plain CSS (`app/globals.css`) — no Tailwind, no component library — with
  light/dark theme support (`ThemeToggle.js`, applied via `data-theme`
  attribute set before first paint to avoid a flash)
- Deployed on Vercel (auto-deploys from GitHub on push to `main`)

## Data model (see schema.sql)
**goals**: id, name, status (Not Started / In Progress / Completed), start_date,
target_date, notes, completed_at, position (for manual drag ordering), user_id,
created_at

**tasks**: id, name, category (General Life / Goal-Related), goal_id
(references goals, nullable, `ON DELETE SET NULL`), priority (High/Medium/Low),
effort (Small/Medium/Large), status (To Do/Done), due_date, start_date,
context (@home/@errand/@computer/@calls — column exists, no UI yet),
recurring (boolean), recurrence_unit, recurrence_interval, position, user_id,
completed_at (set when checked off), focus_date (day it was a top-3 focus
task), created_at

Key relationship: a task can optionally link to one goal via `goal_id`.
General Life tasks leave `goal_id` empty; Goal-Related tasks should have one.

Row Level Security is enabled on both tables — every policy restricts reads
and writes to `auth.uid() = user_id`, and every insert in the app sets
`user_id` to the signed-in user. Each user's data is fully isolated.

## What's built so far

**Today page** (`app/page.js`, the home screen). Deliberately minimal: it
answers "what matters today?" and leaves adding/planning to Tasks.
- Greeting, date, one summary line (due today / overdue / events)
- A slim gold main-goal line (only the goal marked main): name, % done,
  next step (soonest open task) and "Add to focus". When that step is
  already on the Today card it says so instead of repeating it
- One "Today" card ("+ Event" in its header): Focus first (star up to 3
  tasks, `tasks.focus_date` = today), then today's events by time (teal
  rows, ended ones fade) and the due tasks: overdue (oldest first) then due today. A one-line note when the day is empty
- Rescheduling: wherever a task's date shows (overdue rows on Today and
  Plan, the side panel's Overdue, Goals), the date is a button: click it for
  a "Move to" menu with Today, Tomorrow, Next week (next Monday), Pick a
  date…, and No date (`DueDateMenu`, `quickDates` in `lib/dates.js`)
- Click a task's name to edit or delete it in a dialog (`TaskEditModal`,
  which shares save/delete with the Plan page via `saveTaskEdit` /
  `deleteTaskAndSync` in `lib/taskActions.js`)

**Review page** (`app/review/page.js`)
- Week / Month / Year switch (remembered) with ‹ › to step back in time;
  periods and buckets come from `getPeriod` / `periodReport` in `lib/insights.js`
- One summary strip: tasks completed (vs the previous period), goals
  finished, best day (best month in Year view)
- "Tasks completed" column chart: per day (week, month) or per month (year)
- Goals card (top 5, then "Show more"; finished-in-period first, then
  active by progress, with attention flags from `goalsNeedingAttention` in
  `lib/insights.js`: past target date, no next step, no progress in 7+
  days, or ready to finish) beside a "Finished tasks" card grouped like the
  chart (latest 8, then "Show more"); both reset when the period changes
- "Needs a decision": overdue tasks whose "Was due …" date opens the shared
  "Move to" menu; rows (and Finished tasks) open the Edit task dialog. Shows
  only for the current period

**Events** (`events` table, `lib/events.js`, `app/components/EventModal.js`)
- Things that happen at a time (appointments, hangouts): title, date,
  all-day or start/end time, location, notes. Not completed, not counted
  in Review
- Always visually distinct from tasks: events are solid teal blocks with a
  clock icon (tasks are a checkbox + text). Calendar month cells list
  events first (sharing the "+N more" limit), week columns show time,
  title and location, and a legend (■ Events ○ Tasks) sits under the
  calendar. Day view / day panel / Today use "Events" (clock icon, teal)
  and "Tasks" (check icon) headings
- Dates in plain words: typing "Call mom tomorrow", "Pay rent on the 1st",
  "Taxes oct 20", "Review next friday", "in 2 weeks" or "10/30" in the Add bar
  sets the date; in Event mode times too ("Dinner friday 7pm", "3-4pm",
  "at noon", "at 6" = 6 PM). The understood words get a soft highlight right
  in the box (`HighlightInput`: a copy of the text behind the box), and a line
  under it shows the result ("Due Fri, Oct 30") with × to keep the words in
  the name. To make the feature discoverable: the empty box cycles through
  examples ("e.g. Pay rent on the 1st"), an ⓘ in the bar opens one line that
  follows the Task / Event switch: "Add a due date by typing it, like
  “tomorrow”, “fri” or “oct 20”." / "Add the day and time by typing them, like
  “fri 7pm”, “tomorrow at noon” or “oct 20 3-4pm”." (a test checks these
  examples parse), and the Options date field says
  "or type it in the name, e.g. “next fri”". Goal cards' add box highlights the same way;
  the words are taken out of the saved name. Changing the date in Options by
  hand wins. "sun"/"sat" alone aren't read as days ("sun cream").
  Parser: `parseQuickAdd` in `lib/parseQuickAdd.js` (tested)
- One Add bar for everything: a Task / Event switch at its start (Task by
  default). In Event mode the bar turns teal and its options are date,
  all day, start/end (defaulting to the next full hour) and location
- Shortcuts open the same event form (`EventFields`) with the date filled
  in: the filled teal "+ Event" button in the calendar header, "Add an
  event on this day" in the day panel, and "+ Add event" on Today. Click
  any event to edit or delete it
- Plan list view is two columns (stacked on narrow screens). **Scheduled**:
  Overdue, then one heading per day (Today, Tomorrow, "Mon, Oct 19") with
  that day's events (next two weeks, `EVENT_LOOKAHEAD_DAYS`) then its open
  tasks, from `buildAgenda`; Completed (collapsible) at the bottom.
  **No date**: undated open tasks. No lines between rows; events are
  task-shaped rows with a teal clock and time. Drag a task onto a day
  heading or a task in another day to give it that date, or into No date to
  clear it; dropping within the same day reorders. Any active filter hides
  events, with a quiet "N events are hidden while filters are on" line
- Calendar side panel is the same day-by-day **Scheduled** list (`buildAgenda`):
  Overdue, then each day with something on it (Today, Tomorrow, "Mon,
  Oct 19"), events first then open tasks; finished tasks are left out.
  "No date" (open tasks only) sits below it with less of the height.
  The × on side-panel rows appears on hover
- Repeating events (migration `2026-10-17-repeating-events.sql`): the event
  form's "Recurring" + Repeats (Daily / Weekly / Monthly / every N days) +
  optional "Until"; the date field reads "First date". Each series is one
  row; `occurrencesBetween` in `lib/events.js` expands it onto its days for
  Today, the Plan list / side panel (next two weeks) and every calendar view
  (monthly repeats skip months without that day). Rows show "↻ Every week".
  Editing a repeat edits the whole series. The × on a repeat, or "Delete this
  one" in the dialog, skips just that day (`skip_dates`); "Delete all" deletes
  the series; both with Undo (`lib/eventActions.js`). One-off events never
  send the repeat columns, so they keep working before the migration is run
- Today shows events inside its one Today card; events count in the
  summary line

**Plan page** (`app/plan/`, formerly Tasks; `/tasks` redirects here; see
the README for which file does what). Title "Plan", subtitle "Your tasks and events, all in one place."
- Add task form: name, category, goal picker (when Goal-Related), priority,
  effort, due date, recurring toggle (daily/weekly/monthly presets or custom
  N-day interval)
- Tasks and events work the same way everywhere (Today, Plan list, side
  panel, day popup, calendar, Goals): click anywhere on the row to open it
  (`openOnRowClick` in `lib/rowClick.js`; the checkbox, star and buttons
  don't open it), and a × on hover deletes it with Undo. No pencil buttons.
  Tasks open the "Edit task" dialog (`TaskEditModal`), events the event
  dialog; events in task lists use the shared `EventRow`. Calendar grid
  chips open on click but have no × (too small); delete
- Filters: category, status, priority, effort (via a popover panel with a
  badge count and "clear all")
- Sort: due date, priority, effort, newest, oldest, or custom drag order
- Drag-and-drop manual reordering in list view
- List view and calendar view (toggle persisted to localStorage). Calendar
  view supports dragging tasks onto a day to change its due date, dragging to
  the "No date" part of the side panel to unschedule it, and shows
  overdue/due-today styling. The side panel (Scheduled + No date) matches
  the calendar's height with CSS alone (a stretching frame), and scrolls inside
- Completing a recurring task automatically creates the next occurrence
- Completed tasks always sink to the bottom regardless of sort/view

**Goals page** (`app/goals/page.js`)
- One goal can be the **main goal** (`goals.is_main`, at most one per user
  via a unique index): click the ☆ on a goal card (next to ⋯) to star it;
  starring another moves it. Shown first with a gold star
  (gold, so it's distinct from the indigo focus-task stars) and a gold
  border, cleared when finished. Whenever there are active goals and none
  is starred (including right after finishing the main one), a short tip
  suggests picking one; once picked, the main goal's card
  carries a one-line caption with the same message
- Add/edit/delete goals (name, target date, notes); deleting a goal with
  linked tasks prompts to either unlink or cascade-delete them
- Notes show on the goal card (grid) or in the expanded row (list)
- Each goal shown as a card with a **circular SVG progress ring**
  (`CircularProgress.js`) showing % of linked tasks done — this replaced the
  original linear bar per the earlier design request
- Pace label per goal (On track / Behind pace / Not started yet / Past due /
  Completed), computed client-side from % tasks done vs. % of time elapsed
  between start_date and target_date, with overdue-task and past-target-date
  overrides
- Grid view and list view (toggle persisted to localStorage); list view rows
  expand/collapse to show the task checklist
- "+ Add task" on a goal opens a one-line "Add a task…" box
  (`QuickAddTask`) that reads plain-word dates like the Plan Add bar and stays
  open for the next step (Done or Escape closes it); editing a goal's task
  opens the shared Edit task dialog. Goal cards share the width equally
  (no card grows to fit a long task name) and task names wrap
- Drag-and-drop manual reordering of goals

**Feel (Today, Plan, Goals)**
- Changes show instantly and save in the background (`patchTask`); only
  the first load shows placeholders. A `dataVersion` counter drops any
  refresh that started before a newer change, so quick actions don't flicker
- Ticking a task pops the circle green; the row stays a moment (`lingering`,
  ~1.4s), fades, then moves to Completed (focus tasks on Today just stay)
- Deleting a task or event happens at once, with a dark "Deleted: … · Undo"
  note for 6 seconds (`notifyUndo` in `lib/notify.js`, shown by
  `ErrorToast`); ticking a task shows "Done: … · Undo". Undo restores the
  exact row (`restoreTask`) or reopens the task and removes the next
  occurrence a recurring check-off created (`undoTaskDone`). No more
  "click twice to delete" (goal deletion keeps its confirm panel)
- Quick motion: dialogs fade and rise, Options and Completed slide open,
  rows ease in; all off when the device asks for reduced motion
- Dialog buttons are Delete (left) · Cancel · Save (primary last)

**First-visit tours**
- Each page (Today, Plan, Goals, Review) runs a short spotlight tour the
  first time it's opened: the page dims except one part, with a bubble
  (n of N, Skip tour / Back / Next, "Got it" at the end; Escape skips, arrow
  keys step). Steps are in `app/components/tours.js` (CSS targets; a step whose
  target isn't on screen is skipped; `phoneBody` for phone wording); the engine
  is `PageTour`. "Seen" is kept on the account (Supabase user metadata
  `tours_seen`, no table needed) and in localStorage (`lib/tourState.js`).
  "Show the tour again": ? button in the top bar (wide) or the ☰ menu (phones)

**Installable app (PWA)**
- On a phone: open the site, Share → Add to Home Screen (Safari, or Chrome on
  iOS 16.4+; Android Chrome: ⋮ → Install app). It opens full-screen with its
  own icon and a dark status bar, and keeps its own sign-in
- `app/manifest.js` (name, colours, standalone), icons in `public/icons/`
  (made from the flag mark; maskable version for Android) and `app/icon.png`
  (browser tab), iPhone settings in `app/layout.js` (`metadata.appleWebApp`,
  `viewport` with `viewportFit: "cover"`; the top bar pads for the notch)
- `public/sw.js` (registered only in production by `RegisterServiceWorker`):
  pages always come from the network (updates show at once) with
  `public/offline.html` as the fallback; versioned `/_next/static/` files and
  icons are kept for a fast start. Supabase / sign-in requests are never
  stored. Bump `CACHE` in sw.js to clear old stored files

**Notifications** (setup steps in the README)
- Bell in the top bar (☰ → Notifications on phones) opens the settings:
  turn on for this device (iPhone: only from the Home Screen app), Before
  events (default 15 min; Off / At start / 5–60 min), Morning summary (time,
  only when something's on), Overdue nudge (time, only when something's
  overdue), "Send a test notification". Saved per account with the device's
  time zone (`notification_settings`); devices in `push_subscriptions`
- Events: "Reminder" field (Default / None / At start / … / 1 day before →
  `events.reminder_minutes`, null = default, -1 = none; all-day events get
  none). Tasks: "Remind me" date and time (`tasks.remind_at`). Like repeats,
  these columns are only sent when used
- What's due: `dueNotifications` in `lib/notifications.js` (tested). Sending:
  `app/api/notifications/send` (POST, `Authorization: Bearer CRON_SECRET`,
  called every 5 min by Supabase pg_cron, see
  `migrations/2026-10-18-notifications-schedule.sql`) uses the service key
  (`lib/server/supabaseAdmin.js`, server-only) and `web-push`
  (`lib/server/push.js`); each notification is claimed in
  `sent_notifications` first so it goes out once. `public/sw.js` shows it and
  opens the app on tap. In development the dialog explains it only works in
  the live app

**Shared**
- Google auth end-to-end (sign in, session persistence, sign out)
- Dark/light theme toggle
- Reusable `Modal`, `Popover`, and custom `Select` components for consistent
  styling (native `<select>` was replaced)
- `TaskFields` is the single add/edit task form used on both pages (form
  state mapping in `lib/taskForm.js`), so new task fields go in one place
- Date helpers in `lib/dates.js`; unit tests for `lib/` via `npm test` (Vitest)
- Database enforces allowed values with check constraints, requires
  `user_id` (defaults to `auth.uid()`), and indexes `user_id` / `goal_id`.
  Changes to an existing database go in `migrations/`

## Design direction / visual preference
Clean, modern, calm — closer to Things/Todoist than a form-based admin tool.
- One accent color (indigo) for actions, focus and progress; green only
  means "done" (round checkboxes, Completed badges, full progress rings)
- Subtle tinted background with a soft glow at the top; white cards with
  light borders; translucent sticky nav; light and dark themes
- Plan page: a one-line quick-add bar (options expand while typing or via
  "Options"); the list is Scheduled (by day) beside No date, with a
  collapsible Completed section: newest first, grouped Today /
  Yesterday / Earlier this week / Older (`groupCompleted`), 10 at a time
  with "Show more", and a link to Review for longer history
- With a mouse, a row's buttons float over its right end on hover, so
  names use the full width
- Overdue tasks are rescheduled by clicking their date (see Rescheduling)
- No divider lines between rows anywhere (Today, Plan, Goals, Review, side
  panel): rows sit on spacing and highlight on hover
- Task rows show a small details line (friendly dates like "Tomorrow" /
  "Oct 19", goal, priority flag, effort, repeat); drag handles and
  edit/delete appear on hover
- Goal cards: status badge beside the progress ring; edit / reopen / delete
  live in a "⋯" menu. When every task is done, the badge reads "Ready to
  finish" and a "✓ Finish goal" button appears at the right end of the
  progress row (finishing stays a deliberate click)
- Goals can be **paused** (`goals.paused_at`) from the ⋯ menu: they move
  to a collapsed "Paused goals" section (open state remembered), show a
  "Paused since …" badge, are read-only, can't be the main goal (pausing
  clears the star), and stay off Today, the task goal picker, and Review's
  goal list. "Resume goal" brings one back. With more than 5 active goals a
  quiet line suggests pausing some
- Finished goals live in their own "Finished goals" section below the
  active ones (grid and list views), open by default; collapsing it is
  remembered (localStorage `showFinishedGoals`). Shows the 3 most recently
  finished, with "Show more" (3 at a time) and "Show less"
- Calendar has Month, Week and Day modes (remembered like the list/calendar
  toggle); clicking a day opens a panel with that day's tasks and a quick
  add for that date; busy month cells show "+N more"
- Phones (600px and below):
  - A bottom tab bar (Today · Plan · Goals · Review, icons + labels); the top
    bar keeps the logo and a ☰ menu (switch light / dark, Sign out)
  - Plan: the Add bar becomes a floating + button that opens it in a sheet
    (options open, box focused, closes after adding)
  - Every dialog is a bottom sheet (slides up, full width, grab handle)
  - Calendar: month cells show dots (teal = events, grey = open tasks);
    tapping a day lists it under the grid (today at first). Week view stacks
    the days as rows. (`useIsPhone` in app/components)
  - Touch screens get bigger targets (22px checkboxes, 40px buttons, roomier
    menus) and row buttons are always visible
- Phones: tapping a row opens it; the Add bar
  puts the Task/Event switch and Options on top, text box and Add below;
  the top bar drops the "PathFinder" word so all tabs fit; calendar
  controls wrap so nothing scrolls sideways. Month cells show task names
  on up to two lines
- All pages share one page width (1360px max), so switching views or pages
  doesn't change the layout width
- Normal-case field labels, not small uppercase

## Not yet built (roadmap)
- **Context tag UI** (@home/@errand/@computer/@calls) — the `context` column
  exists on `tasks` but there is no picker in the add/edit forms and no
  filter for it. This is the only remaining item from the original roadmap.
- Goal `status` field (Not Started/In Progress/Completed) isn't shown in the
  UI, but the app keeps it in sync with what the goal card shows: Completed
  once finished, In Progress once any linked task is done, otherwise Not
  Started (`lib/goalCompletion.js`).

## Origin note
This app is a from-scratch rebuild of a template I originally built in
Notion (using the Notion API) — the goal/task/category/priority/effort
structure mirrors that Notion setup, adapted into a real relational schema.
