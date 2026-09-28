-- Lets you mark one goal as your main goal. Run once in Supabase:
-- SQL Editor -> New query -> paste -> Run.

alter table goals add column if not exists is_main boolean not null default false;

-- At most one main goal per person.
create unique index if not exists goals_one_main_per_user on goals (user_id) where is_main;
