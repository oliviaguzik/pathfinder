-- Security: a device's notification address must belong to a real
-- notification service (Apple, Google, Mozilla, Microsoft), so nobody can save
-- an address that points PathFinder's server at some other site. The app
-- checks this too; this makes the database refuse it as well.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table push_subscriptions
  add constraint push_subscriptions_known_service check (
    endpoint ~ '^https://([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)/'
  ) not valid;
