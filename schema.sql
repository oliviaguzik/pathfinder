-- Run this in Supabase: Project -> SQL Editor -> New query -> paste -> Run

create extension if not exists "uuid-ossp";

create table goals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text not null default 'Not Started', -- Not Started | In Progress | Achieved
  start_date date,
  target_date date,
  notes text,
  created_at timestamp with time zone default now()
);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null default 'General Life', -- General Life | Goal-Related
  goal_id uuid references goals(id) on delete set null,
  priority text default 'Medium', -- High | Medium | Low
  effort text default 'Medium', -- Small | Medium | Large
  status text not null default 'To Do', -- To Do | In Progress | Done
  due_date date,
  start_date date,
  context text, -- @home | @errand | @computer | @calls
  recurring boolean default false,
  created_at timestamp with time zone default now()
);

-- For a personal single-user project, allow full access with the anon key.
-- (If you add login/auth later, replace these with per-user policies.)
alter table goals enable row level security;
alter table tasks enable row level security;

create policy "allow all on goals" on goals for all using (true) with check (true);
create policy "allow all on tasks" on tasks for all using (true) with check (true);
