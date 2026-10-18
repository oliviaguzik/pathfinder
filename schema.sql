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
  remind_at timestamp with time zone, -- optional reminder notification at this moment
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
  -- Repeating: every `recurrence_interval` days / weeks / months (null = once),
  -- optionally until a date, minus any skipped dates.
  recurrence_unit text check (recurrence_unit in ('day', 'week', 'month')),
  recurrence_interval integer not null default 1 check (recurrence_interval >= 1),
  repeat_until date,
  skip_dates date[] not null default '{}',
  -- Reminder minutes before (null = the person's default, -1 = none).
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes >= -1),
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

-- ---------- Notifications ----------
-- One row per device that has notifications turned on. The endpoint and keys
-- are the private address Apple / Google gave that device.
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Your notification settings (one row per person). Null means "off".
create table if not exists notification_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- Minutes before an event (an event can choose its own).
  event_lead_minutes integer default 15 check (event_lead_minutes is null or event_lead_minutes >= 0),
  morning_summary_time time default '08:00',
  overdue_nudge_time time default '19:00',
  -- Your time zone, so "8:00" and event times mean your local time.
  time_zone text not null default 'UTC',
  updated_at timestamp with time zone default now()
);

-- What's already been sent (kind + which event/day/task), so a reminder goes
-- out once even if the check runs twice.
create table if not exists sent_notifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  ref text not null,
  sent_at timestamp with time zone default now(),
  primary key (user_id, kind, ref)
);

alter table push_subscriptions enable row level security;
alter table notification_settings enable row level security;
alter table sent_notifications enable row level security;

create policy "users manage their own devices" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage their own notification settings" on notification_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users see what was sent to them" on sent_notifications
  for select using (auth.uid() = user_id);
