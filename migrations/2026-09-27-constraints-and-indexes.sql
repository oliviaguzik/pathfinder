-- Brings an existing database up to date with schema.sql. Run once in Supabase:
-- SQL Editor -> New query -> paste -> Run. (A fresh setup only needs schema.sql.)

-- Goal status: Achieved was renamed to Completed; recompute every goal to
-- match its tasks so the check constraint below can apply.
update goals set status = 'Completed' where completed_at is not null;
update goals g
set status = case
  when exists (select 1 from tasks t where t.goal_id = g.id and t.status = 'Done')
    then 'In Progress'
  else 'Not Started'
end
where completed_at is null;

-- Rows without an owner are invisible to everyone under RLS, so drop any
-- before making user_id required.
delete from tasks where user_id is null;
delete from goals where user_id is null;

alter table goals
  alter column user_id set not null,
  alter column user_id set default auth.uid(),
  drop constraint if exists goals_user_id_fkey,
  add constraint goals_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint goals_status_check check (status in ('Not Started', 'In Progress', 'Completed'));

alter table tasks
  alter column user_id set not null,
  alter column user_id set default auth.uid(),
  drop constraint if exists tasks_user_id_fkey,
  add constraint tasks_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint tasks_category_check check (category in ('General Life', 'Goal-Related')),
  add constraint tasks_priority_check check (priority in ('High', 'Medium', 'Low')),
  add constraint tasks_effort_check check (effort in ('Small', 'Medium', 'Large')),
  add constraint tasks_status_check check (status in ('To Do', 'Done')),
  add constraint tasks_context_check check (context in ('@home', '@errand', '@computer', '@calls')),
  add constraint tasks_recurrence_unit_check check (recurrence_unit in ('day', 'week', 'month')),
  add constraint tasks_recurrence_interval_check check (recurrence_interval >= 1);

create index if not exists goals_user_id_idx on goals (user_id);
create index if not exists tasks_user_id_idx on tasks (user_id);
create index if not exists tasks_goal_id_idx on tasks (goal_id);
