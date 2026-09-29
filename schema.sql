-- Run this in Supabase: Project -> SQL Editor -> New query -> paste -> Run

create extension if not exists "uuid-ossp";

create table goals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  -- Kept in sync by the app (lib/goalCompletion.js) to match the goal card.
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'Completed')),
  start_date date,
  target_date date,
  notes text,
  completed_at timestamp with time zone,
  position double precision,
  is_main boolean not null default false, -- the one goal to put first (see index below)
  paused_at timestamp with time zone, -- set while a goal is paused (set aside, not finished)
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now()
);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null default 'General Life'
    check (category in ('General Life', 'Goal-Related')),
  goal_id uuid references goals(id) on delete set null,
  priority text default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  effort text default 'Medium' check (effort in ('Small', 'Medium', 'Large')),
  status text not null default 'To Do' check (status in ('To Do', 'Done')),
  due_date date,
  start_date date,
  context text check (context in ('@home', '@errand', '@computer', '@calls')),
  recurring boolean default false,
  recurrence_unit text check (recurrence_unit in ('day', 'week', 'month')),
  recurrence_interval integer default 1 check (recurrence_interval >= 1),
  position double precision,
  completed_at timestamp with time zone, -- set when checked off; powers Today and Review
  focus_date date, -- the day this task was picked as one of that day's top 3
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now()
);

-- Things that happen at a time (appointments, hangouts…), shown on the
-- calendar and Today's schedule. Unlike tasks, they aren't completed.
create table events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  date date not null,
  all_day boolean not null default false,
  start_time time,
  end_time time,
  location text,
  notes text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  constraint events_time_check check (all_day or start_time is not null),
  constraint events_end_after_start check (end_time is null or start_time is null or end_time > start_time)
);

-- Every query filters by user (via RLS), and goal pages look tasks up by goal.
create index goals_user_id_idx on goals (user_id);
create index tasks_user_id_idx on tasks (user_id);
create index tasks_goal_id_idx on tasks (goal_id);
-- At most one main goal per person.
create unique index goals_one_main_per_user on goals (user_id) where is_main;
create index events_user_date_idx on events (user_id, date);

-- Auth is Google sign-in via Supabase Auth. Each row is owned by the signed-in
-- user, and RLS restricts every operation to rows matching their own user_id.
alter table goals enable row level security;
alter table tasks enable row level security;
alter table events enable row level security;

create policy "users manage their own goals" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own events" on events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
