-- Checks for due notifications every 5 minutes by calling the app's
-- /api/notifications/send. Run once in Supabase AFTER 2026-10-17-notifications.sql
-- and after the app (with its secret keys) is live on Vercel:
-- SQL Editor -> New query -> paste -> replace the two <...> parts -> Run.
--
--   <YOUR-APP-ADDRESS>  your Vercel address, e.g. https://pathfinder-xyz.vercel.app
--   <YOUR-CRON-SECRET>  the CRON_SECRET value from .env.local (also set in Vercel)
--
-- The secret stays inside your own database; don't paste it anywhere else.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'pathfinder-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := '<YOUR-APP-ADDRESS>/api/notifications/send',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <YOUR-CRON-SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To stop it later: select cron.unschedule('pathfinder-notifications');
