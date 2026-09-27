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

## Scripts
- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm test`: unit tests for the logic in `lib/` (dates, recurrence,
  ordering, goal status, task form)

## Project layout
- `app/page.js`: Tasks page (list and calendar views)
- `app/goals/page.js`: Goals page (grid and list views)
- `app/components/`: shared UI (`TaskFields` is the add/edit task form used
  on both pages, plus `Select`, `Modal`, `Popover`, and more)
- `lib/`: logic with no UI: Supabase client, auth, dates, recurrence,
  drag ordering, goal status/completion, task form mapping
- `schema.sql`: full database setup; `migrations/`: changes for existing databases

## Troubleshooting
- **Blank page or fetch errors**: check `.env.local`, then restart `npm run dev`.
- **"relation does not exist"**: `schema.sql` didn't run; run it again and check for errors.
- **Google sign-in redirects to the wrong place**: add the URL to Supabase's redirect allow list.
- **Vercel build fails**: usually a missing environment variable in the Vercel project settings.
