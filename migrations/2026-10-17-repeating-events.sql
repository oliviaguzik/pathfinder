-- Lets events repeat (a weekly class, a monthly meetup). Each repeating event
-- is still one row; the app shows its repeats on the right days.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table events
  -- How often it repeats: every `recurrence_interval` days / weeks / months.
  -- Empty means it doesn't repeat.
  add column if not exists recurrence_unit text
    check (recurrence_unit in ('day', 'week', 'month')),
  add column if not exists recurrence_interval integer not null default 1
    check (recurrence_interval >= 1),
  -- Optional last day it can happen on.
  add column if not exists repeat_until date,
  -- Single dates taken out of the series ("delete just this one").
  add column if not exists skip_dates date[] not null default '{}';
