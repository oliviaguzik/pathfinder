-- Lets you pause a goal (set it aside without finishing or deleting it).
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table goals add column if not exists paused_at timestamp with time zone;
