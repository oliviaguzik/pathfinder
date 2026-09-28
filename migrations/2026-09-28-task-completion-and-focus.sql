-- Adds what the Today and Review pages need. Run once in Supabase:
-- SQL Editor -> New query -> paste -> Run.

-- When a task was checked off (cleared if it's unchecked). Tasks finished
-- before this existed have no date, so Review starts counting from now.
alter table tasks add column if not exists completed_at timestamp with time zone;

-- The day a task was picked as one of that day's top 3 focus tasks.
alter table tasks add column if not exists focus_date date;
