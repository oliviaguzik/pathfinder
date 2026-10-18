-- Checks for due notifications every minute instead of every 5, so reminders
-- arrive on time rather than up to 5 minutes late. Run once in Supabase AFTER
-- 2026-10-17-notifications-schedule.sql: SQL Editor -> New query -> paste -> Run.
-- (No secrets to fill in: it only changes how often the existing check runs.)

select cron.alter_job(
  (select jobid from cron.job where jobname = 'pathfinder-notifications'),
  schedule := '* * * * *'
);

-- To check it worked: select jobname, schedule, active from cron.job;
