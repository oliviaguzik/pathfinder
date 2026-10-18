# PathFinder

A personal task and goal tracker: tasks (general life or linked to a goal) with
priority, effort, due dates and recurrence, shown as a list or a calendar; and
goals with progress rings, pace labels, notes, and finish/reopen. Sign-in is
with Google, and each user only ever sees their own data.

Built with Next.js (App Router, JavaScript), Supabase (Postgres + Auth) and
plain CSS, deployed on Vercel. See `PROJECT_BRIEF.md` for the full feature
list and data model.

## Setup

### 1. Database (Supabase)
1. Create a project at https://supabase.com.
2. In **SQL Editor → New query**, paste all of `schema.sql` and click **Run**.
3. In **Authentication → Providers**, enable **Google** and add your Google
   OAuth client ID and secret.
4. In **Authentication → URL Configuration**, add your local
   (`http://localhost:3000`) and deployed URLs to the redirect allow list.
5. From **Project Settings → API**, copy the **Project URL** and the
   **anon public** key (not the service_role key).

Upgrading an existing database? Run the files in `migrations/` that are
newer than your setup, in date order, the same way.

### 2. Run locally
Requires Node.js 18.17 or newer.
```
npm install
cp .env.local.example .env.local   # then paste in the URL and anon key
npm run dev
```
Open http://localhost:3000 and sign in with Google.

### 3. Deploy (Vercel)
Import the GitHub repo in Vercel and add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables. Every push to
`main` redeploys.

## Notifications setup

Notifications (event reminders, morning summary, overdue nudge, task
reminders) need a few one-time steps. Secrets go only in `.env.local` and
Vercel's settings, never in the code or anywhere public.

1. **Database:** run `migrations/2026-10-18-notifications.sql` in Supabase
   (SQL Editor → New query → paste → Run).
2. **Keys:** `.env.local` already has `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET`. Add
   `SUPABASE_SERVICE_ROLE_KEY` yourself: Supabase → Project Settings → API
   Keys → the secret `service_role` key. It can read everyone's data, so it
   must never be shared or given a `NEXT_PUBLIC_` name. Set `VAPID_SUBJECT`
   to `mailto:` plus your email.
3. **Vercel:** Project → Settings → Environment Variables → add all five
   (same names and values as `.env.local`), then redeploy (push).
4. **Schedule:** in Supabase run
   `migrations/2026-10-18-notifications-schedule.sql`, with your live address
   and `CRON_SECRET` filled in. It checks every 5 minutes.
5. **Turn on:** open the live app (on iPhone, from the Home Screen), tap the
   bell (or ☰ → Notifications), Turn on, then "Send a test notification".

How it works: `lib/notifications.js` decides what's due (tested);
`app/api/notifications/send` (called by the schedule, protected by
`CRON_SECRET`) loads each person's data with the service key and sends
through `web-push`; `public/sw.js` shows the notification and opens the app
when it's tapped. `sent_notifications` stops anything going out twice.

## Scripts
- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm test`: unit tests for the logic in `lib/`

## Project layout
- `app/page.js`: Today (home screen: events, main goal, focus, tasks due)
- `app/plan/`: Plan page, formerly Tasks (`app/tasks/page.js` just redirects
  here). `page.js` wires it together; `usePlanData.js` holds the data and every
  change (instant updates, Undo); `AddBar.js`, `FilterBar.js`, `PlanList.js`
  (Scheduled beside No date) and `PlanCalendar.js` (Month / Week / Day and the
  side panel) are the parts; `rows.js` has the task and event rows they share
  through `PlanContext.js`
- `app/review/page.js`: Review (week / month / year stats, chart, goal check-in)
- `app/goals/page.js`: Goals page (main goal, paused and finished goals)
- `app/components/`: shared UI (`TaskFields` / `EventFields` are the shared
  add/edit forms, `EventModal`, `TaskMeta`, `Menu`, `ErrorToast`, and more)
- `lib/`: logic with no UI: Supabase client, auth, dates, events,
  recurrence, drag ordering, goal status, insights (review periods, goal
  nudges), task grouping, task form mapping
- `schema.sql`: full database setup; `migrations/`: changes for existing databases

## Troubleshooting
- **Blank page or fetch errors**: check `.env.local`, then restart `npm run dev`.
- **"relation does not exist"**: `schema.sql` didn't run; run it again and check for errors.
- **Google sign-in redirects to the wrong place**: add the URL to Supabase's redirect allow list.
- **Vercel build fails**: usually a missing environment variable in the Vercel project settings.
