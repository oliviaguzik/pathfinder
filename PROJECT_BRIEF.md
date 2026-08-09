# Project brief: Task & Goal Tracker

## What this is
A personal web app replacing a Notion-based task/goal tracker. It's a
Next.js app with a Supabase (Postgres) backend, deployed on Vercel.

## Tech stack
- Next.js (App Router, JavaScript, no TypeScript)
- Supabase for the database (Postgres) — connected via `@supabase/supabase-js`
  in `lib/supabaseClient.js`, using env vars `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Plain CSS (`app/globals.css`) — no Tailwind, no component library
- Deployed on Vercel (auto-deploys from GitHub on push)

## Data model (see schema.sql)
**goals**: id, name, status (Not Started / In Progress / Achieved), start_date,
target_date, notes, created_at

**tasks**: id, name, category (General Life / Goal-Related), goal_id
(references goals, nullable), priority (High/Medium/Low), effort
(Small/Medium/Large), status (To Do/In Progress/Done), due_date, start_date,
context (@home/@errand/@computer/@calls), recurring (boolean), created_at

Key relationship: a task can optionally link to one goal via `goal_id`.
General Life tasks leave `goal_id` empty; Goal-Related tasks should have one.

## What's built so far
- `app/page.js` — Tasks page: add task form (name, category, goal picker,
  priority, effort, due date), filter by category/status, checkbox to mark
  done, delete button
- `app/goals/page.js` — Goals page: add goal form (name, target date), each
  goal shown as a card with a progress bar (straight/linear, %  of linked
  tasks marked Done), an expandable/collapsible task checklist per goal, and
  a basic pace label (On track / Behind pace / Not started yet / Past due) —
  computed client-side by comparing % tasks done against % of time elapsed
  between start_date and target_date

## Design direction / visual preference
I like a clean, minimal, native-feeling UI (see `app/globals.css` for the
current look: white cards, subtle borders, small badges for priority/category,
system font). One specific change I want: **swap the linear progress bar
on the Goals page for a circular progress ring with the percentage shown in
the center** — this was inspired by a mockup Claude showed me with a
circular ring + percentage rather than a horizontal bar. Please implement
that as an SVG-based circular progress component.

## Not yet built (roadmap)
- Recurring task handling (the `recurring` column exists but isn't used in the UI yet)
- Context tag UI + filtering (@home/@errand/@computer/@calls — column exists, no UI)
- Calendar view of tasks by due date
- Editing existing tasks (currently only add / mark done / delete)
- Authentication (currently single-user, no login — RLS policies are wide
  open "allow all", meant to be tightened later if auth is added)

## Origin note
This app is a from-scratch rebuild of a template I originally built in
Notion (using the Notion API) — the goal/task/category/priority/effort
structure mirrors that Notion setup, adapted into a real relational schema.
