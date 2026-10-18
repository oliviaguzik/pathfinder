-- Notifications: where to send them (each phone or browser you turn them on
-- in), your settings, reminder choices on events and tasks, and a log so
-- nothing is sent twice.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- One row per device that has notifications turned on. The endpoint and keys
-- are the private address Apple / Google gave that device.
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Your notification settings (one row per person). Null means "off".
create table if not exists notification_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- Minutes before an event (an event can choose its own).
  event_lead_minutes integer default 15 check (event_lead_minutes is null or event_lead_minutes >= 0),
  morning_summary_time time default '08:00',
  overdue_nudge_time time default '19:00',
  -- Your time zone, so "8:00" and event times mean your local time.
  time_zone text not null default 'UTC',
  updated_at timestamp with time zone default now()
);

-- What's already been sent (kind + which event/day/task), so a reminder goes
-- out once even if the check runs twice.
create table if not exists sent_notifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  ref text not null,
  sent_at timestamp with time zone default now(),
  primary key (user_id, kind, ref)
);

-- An event's own reminder: minutes before (null = your default, -1 = none).
alter table events add column if not exists reminder_minutes integer
  check (reminder_minutes is null or reminder_minutes >= -1);

-- A task's reminder: an exact date and time.
alter table tasks add column if not exists remind_at timestamp with time zone;

-- Everyone can only see and change their own rows. The sending server uses
-- Supabase's private service key, which is only ever stored on the server.
alter table push_subscriptions enable row level security;
alter table notification_settings enable row level security;
alter table sent_notifications enable row level security;

create policy "users manage their own devices" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage their own notification settings" on notification_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users see what was sent to them" on sent_notifications
  for select using (auth.uid() = user_id);
