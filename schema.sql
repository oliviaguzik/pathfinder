-- Run this in Supabase: Project -> SQL Editor -> New query -> paste -> Run

create extension if not exists "uuid-ossp";

create table goals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text not null default 'Not Started', -- Not Started | In Progress | Achieved
  start_date date,
  target_date date,
  notes text,
  completed_at timestamp with time zone,
  position double precision,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null default 'General Life', -- General Life | Goal-Related
  goal_id uuid references goals(id) on delete set null,
  priority text default 'Medium', -- High | Medium | Low
  effort text default 'Medium', -- Small | Medium | Large
  status text not null default 'To Do', -- To Do | Done
  due_date date,
  start_date date,
  context text, -- @home | @errand | @computer | @calls
  recurring boolean default false,
  recurrence_unit text, -- day | week | month (interpreted with recurrence_interval)
  recurrence_interval integer default 1,
  position double precision,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- Auth is Google sign-in via Supabase Auth. Each row is owned by the signed-in
-- user, and RLS restricts every operation to rows matching their own user_id.
alter table goals enable row level security;
alter table tasks enable row level security;

create policy "users manage their own goals" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
