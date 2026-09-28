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
- Greeting, date, one summary line (due today / overdue)
- Main goal card (only the goal marked main): progress ring, next step
  (soonest open task), and "Add to focus" for that step
- Today's focus: star up to 3 tasks (`tasks.focus_date` = today)
- One "Today" list: overdue (oldest first, hover for Today / Tomorrow)
  then due today

**Review page** (`app/review/page.js`)
- Week / Month / Year switch (remembered) with ‹ › to step back in time;
  periods and buckets come from `getPeriod` / `periodReport` in `lib/insights.js`
- One summary strip: tasks completed (vs the previous period), goals
  finished, best day (best month in Year view)
- "Tasks completed" column chart: per day (week, month) or per month (year)
- Goals card (finished-in-period first, then active by progress, with
  attention flags from `goalsNeedingAttention` in `lib/insights.js`: past
  target date, no next step, no progress in 7+ days, or ready to finish) beside a Finished card grouped like the chart
- "Needs a decision" (overdue tasks with Today / Tomorrow / Next week /
  No date) shows only for the current period

**Tasks page** (`app/tasks/page.js`)
- Add task form: name, category, goal picker (when Goal-Related), priority,
  effort, due date, recurring toggle (daily/weekly/monthly presets or custom
  N-day interval)
- Edit any existing task inline (or via modal in calendar view); delete
- Filters: category, status, priority, effort (via a popover panel with a
  badge count and "clear all")
- Sort: due date, priority, effort, newest, oldest, or custom drag order
- Drag-and-drop manual reordering in list view
- List view and calendar view (toggle persisted to localStorage). Calendar
  view supports dragging tasks onto a day to change its due date, dragging to
  the "No due date" side panel to unschedule it, and shows overdue/due-today
  styling
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
- Inline add/edit task forms scoped to a goal (same fields as the Tasks page,
  including recurrence)
- Drag-and-drop manual reordering of goals

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
- Tasks page: a one-line quick-add bar (options expand while typing or via
  "Options"); the list is grouped into Overdue / Today / Upcoming / No date,
  with a collapsible Completed section: newest first, grouped Today /
  Yesterday / Earlier this week / Older (`groupCompleted`), 10 at a time
  with "Show more", and a link to Review for longer history
- Task rows show a small details line (friendly dates like "Tomorrow" /
  "Oct 19", goal, priority flag, effort, repeat); drag handles and
  edit/delete appear on hover
- Goal cards: status badge beside the progress ring; edit / reopen / delete
  live in a "⋯" menu. When every task is done, the badge reads "Ready to
  finish" and a "✓ Finish goal" button appears at the right end of the
  progress row (finishing stays a deliberate click)
- Finished goals live in their own "Finished goals" section below the
  active ones (grid and list views), open by default; collapsing it is
  remembered (localStorage `showFinishedGoals`). Shows the 3 most recently
  finished, with "Show more" (3 at a time) and "Show less"
- Calendar has Month, Week and Day modes (remembered like the list/calendar
  toggle); clicking a day opens a panel with that day's tasks and a quick
  add for that date; busy month cells show "+N more"
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
