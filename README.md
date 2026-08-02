# Task Tracker — starter app

A Next.js + Supabase task/goal tracker: add tasks, categorize them as General
Life or Goal-Related, link goal-related tasks to a specific goal, and see a
per-goal progress bar with an expandable checklist and a basic pace
indicator (on track / behind pace).

## 1. Create your database (Supabase — free)

1. Go to https://supabase.com → sign up (free) → "New project"
2. Pick a name and password (save the password somewhere), choose a region, click Create — takes about 2 minutes to provision
3. Once it's ready, go to the **SQL Editor** (left sidebar) → **New query**
4. Open `schema.sql` in this folder, copy all of it, paste into the SQL editor, click **Run**
5. Go to **Project Settings → API** (left sidebar, gear icon) — you'll need two values from this page in step 3 below:
   - **Project URL**
   - **anon public** key (NOT the service_role key — that one is more powerful and shouldn't be used in a browser app)

## 2. Install Node.js (skip if you already have it)
Download from https://nodejs.org (LTS version). Check with `node -v` in a terminal — need 18+.

## 3. Set up the project locally

1. Open this folder in VS Code
2. In the terminal, run:
   ```
   npm install
   ```
3. Copy `.env.local.example` to a new file called `.env.local`:
   ```
   cp .env.local.example .env.local
   ```
4. Open `.env.local` and paste in your Supabase Project URL and anon key from step 1.5
5. Run the dev server:
   ```
   npm run dev
   ```
6. Open http://localhost:3000 in your browser — you should see the Tasks page. Try adding a task and a goal (via the Goals tab) and linking one to the other.

## 4. Push to GitHub
Vercel deploys straight from a GitHub repo.
1. Create a new repo on https://github.com/new (don't initialize with a README, you already have one)
2. In your terminal, in this project folder:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git push -u origin main
   ```

**Important:** `.env.local` is already excluded via `.gitignore` below — don't remove that, or your Supabase key ends up public on GitHub.

## 5. Deploy to Vercel (free)

1. Go to https://vercel.com → sign up with your GitHub account
2. Click **"Add New" → "Project"** → select your repo → **Import**
3. Before deploying, expand **"Environment Variables"** and add the same two values from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy** — takes about a minute
5. You'll get a live URL (like `your-app.vercel.app`) — that's your app, live on the internet, accessible from any device

Every time you `git push` after this, Vercel automatically redeploys.

## What's included vs. what to add later

**Included:** Tasks (name, category, goal link, priority, effort, due date, status), Goals (name, target date, start date), category/status filters, per-goal progress bar and expandable task checklist, a basic pace indicator.

**Not yet included** (easy to add once the base is working — just ask): Recurring tasks, Context tags, Calendar view, editing existing tasks (currently: add/complete/delete only), authentication (right now anyone with your URL and no login could theoretically use it — fine solo, but worth adding if you ever share the link).

## Troubleshooting
- **Blank page / fetch errors** — double check `.env.local` has the right Supabase URL and anon key, then restart `npm run dev`.
- **"relation does not exist"** — the schema.sql didn't run successfully; go back to Supabase's SQL Editor and run it again, check for red error text.
- **Vercel build fails** — usually a missing environment variable; check they're added under Project Settings → Environment Variables on Vercel, not just locally.
