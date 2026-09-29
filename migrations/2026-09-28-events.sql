-- Adds events (appointments, hangouts…): things that happen at a time, as
-- opposed to tasks you complete. Run once in Supabase:
-- SQL Editor -> New query -> paste -> Run.

create table if not exists events (
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
  -- A timed event needs a start; an end, if given, comes after it.
  constraint events_time_check check (all_day or start_time is not null),
  constraint events_end_after_start check (end_time is null or start_time is null or end_time > start_time)
);

create index if not exists events_user_date_idx on events (user_id, date);

alter table events enable row level security;

create policy "users manage their own events" on events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
