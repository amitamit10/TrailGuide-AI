-- New trip config fields from wizard Phase 3
alter table trips
  add column if not exists transport_mode text,
  add column if not exists max_walk_minutes int,
  add column if not exists break_minutes int;

-- Insert policy for profiles (needed for settings page)
drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Telegram webhook needs to update any profile by chat_id (service role only, handled server-side)
