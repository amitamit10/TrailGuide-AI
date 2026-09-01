-- TrailGuide AI — full schema bootstrap for a blank Supabase project.
-- Generated from supabase/migrations/*.sql. Paste into the SQL Editor and Run.
-- Safe to re-run: every statement is guarded.

-- ============================================================
-- 001_initial_schema.sql
-- ============================================================
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase Auth)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  telegram_chat_id text unique,
  full_name text,
  avatar_url text,
  default_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger as $$
declare
  full_name text;
  avatar_url text;
begin
  full_name := coalesce(
    new.user_metadata->>'full_name',
    new.raw_user_meta_data->>'full_name',
    new.user_metadata->>'name',
    new.raw_user_meta_data->>'name'
  );
  avatar_url := coalesce(
    new.user_metadata->>'avatar_url',
    new.raw_user_meta_data->>'avatar_url',
    new.user_metadata->>'picture',
    new.raw_user_meta_data->>'picture'
  );

  insert into profiles (id, full_name, avatar_url)
  values (new.id, full_name, avatar_url);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Trips
create table if not exists trips (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  destination text not null,
  destination_lat float,
  destination_lng float,
  departure_city text,
  start_date date not null,
  end_date date not null,
  travelers_count int not null default 1,
  traveler_ages int[],
  flights_booked boolean not null default false,
  hotels_booked boolean not null default false,
  budget_total numeric,
  budget_currency text not null default 'USD',
  travel_style text not null default 'balanced',
  interests text[] not null default '{}',
  status text not null default 'planning',
  created_at timestamptz not null default now()
);

-- Itinerary days
create table if not exists itinerary_days (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  day_number int not null,
  date date not null,
  notes text,
  unique(trip_id, day_number)
);

-- Activities
create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid references itinerary_days(id) on delete cascade not null,
  trip_id uuid references trips(id) on delete cascade not null,
  title text not null,
  description text,
  category text not null default 'attraction',
  start_time time,
  end_time time,
  duration_minutes int,
  location_name text,
  address text,
  lat float,
  lng float,
  estimated_cost numeric,
  photo_url text,
  photo_query text,
  rating float,
  notes text,
  is_completed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Uploaded booking documents
create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  type text not null,
  file_url text,
  extracted_json jsonb,
  created_at timestamptz not null default now()
);

-- AI chat history
create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade,
  session_id text,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Live companion nudges
create table if not exists companion_nudges (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  type text not null,
  message text not null,
  action_label text,
  action_data jsonb,
  sent_at timestamptz not null default now(),
  dismissed_at timestamptz
);

-- Row Level Security
alter table profiles enable row level security;
alter table trips enable row level security;
alter table itinerary_days enable row level security;
alter table activities enable row level security;
alter table documents enable row level security;
alter table chat_messages enable row level security;
alter table companion_nudges enable row level security;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"   on profiles for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "Users can manage own trips" on trips;
create policy "Users can manage own trips" on trips for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own trip days" on itinerary_days;
create policy "Users can manage own trip days" on itinerary_days for all
  using (exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid()));

drop policy if exists "Users can manage own activities" on activities;
create policy "Users can manage own activities" on activities for all
  using (exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid()));

drop policy if exists "Users can manage own documents" on documents;
create policy "Users can manage own documents" on documents for all
  using (exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid()));

drop policy if exists "Users can manage own chat messages" on chat_messages;
create policy "Users can manage own chat messages" on chat_messages for all
  using (
    trip_id is null
    or exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid())
  );

drop policy if exists "Users can manage own nudges" on companion_nudges;
create policy "Users can manage own nudges" on companion_nudges for all
  using (exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid()));

-- ============================================================
-- 002_phase4_columns.sql
-- ============================================================
-- New trip config fields from wizard Phase 3
alter table trips
  add column if not exists transport_mode text,
  add column if not exists max_walk_minutes int,
  add column if not exists break_minutes int;

-- Insert policy for profiles (needed for settings page)
drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Telegram webhook needs to update any profile by chat_id (service role only, handled server-side)

-- ============================================================
-- 003_expenses.sql
-- ============================================================
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  amount numeric not null,
  category text not null default 'other',
  note text,
  date date not null default current_date,
  receipt_url text,
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

drop policy if exists "Users can manage own expenses" on expenses;
create policy "Users can manage own expenses" on expenses for all
  using (
    auth.uid() = user_id
    and exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid())
  );

create index if not exists expenses_trip_id_idx on expenses(trip_id);

-- ============================================================
-- 004_checklist.sql
-- ============================================================
create table if not exists checklist_items (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  label text not null,
  category text not null default 'general',
  is_checked boolean not null default false,
  source text not null default 'ai',
  created_at timestamptz not null default now()
);

alter table checklist_items enable row level security;

drop policy if exists "Users can manage own checklist" on checklist_items;
create policy "Users can manage own checklist" on checklist_items for all
  using (
    auth.uid() = user_id
    and exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid())
  );

create index if not exists checklist_trip_id_idx on checklist_items(trip_id);

-- ============================================================
-- 005_public_trips.sql
-- ============================================================
alter table trips add column if not exists is_public boolean not null default false;

-- Allow anyone (including anon) to read public trips
drop policy if exists "Anyone can view public trips" on trips;
create policy "Anyone can view public trips" on trips
  for select using (is_public = true);

-- Allow anyone to read days and activities for public trips
drop policy if exists "Anyone can view public trip days" on itinerary_days;
create policy "Anyone can view public trip days" on itinerary_days
  for select using (
    exists (select 1 from trips where trips.id = trip_id and trips.is_public = true)
  );

drop policy if exists "Anyone can view public activities" on activities;
create policy "Anyone can view public activities" on activities
  for select using (
    exists (
      select 1 from itinerary_days
      join trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = day_id and trips.is_public = true
    )
  );

-- ============================================================
-- 006_activity_photos.sql
-- ============================================================
create table if not exists activity_photos (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid references activities(id) on delete cascade not null,
  trip_id uuid references trips(id) on delete cascade not null,
  storage_path text not null,
  caption text,
  created_at timestamptz default now()
);

alter table activity_photos enable row level security;

drop policy if exists "Users can manage own activity photos" on activity_photos;
create policy "Users can manage own activity photos" on activity_photos
  for all using (
    exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid())
  )
  with check (
    exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid())
  );

create index if not exists activity_photos_activity_id_idx on activity_photos(activity_id);

-- ============================================================
-- 007_culture_currency_cache.sql
-- ============================================================
create table if not exists culture_cache (
  destination text primary key,
  data jsonb not null,
  cached_at timestamptz default now()
);

create table if not exists currency_cache (
  base_currency text primary key,
  rates jsonb not null,
  cached_at timestamptz default now()
);

-- ============================================================
-- 008_trip_members.sql
-- ============================================================
-- Create trip_members table for real-time collaboration
CREATE TABLE IF NOT EXISTS trip_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'editor',
  invited_by uuid REFERENCES profiles(id),
  invited_email text,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

-- Trip owner can see all members of their trips
DROP POLICY IF EXISTS "trip_members_select" ON trip_members;
CREATE POLICY "trip_members_select" ON trip_members
  FOR SELECT USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Only trip owner can insert (invite)
DROP POLICY IF EXISTS "trip_members_insert" ON trip_members;
CREATE POLICY "trip_members_insert" ON trip_members
  FOR INSERT WITH CHECK (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );

-- Owner can delete any member; member can remove themselves
DROP POLICY IF EXISTS "trip_members_delete" ON trip_members;
CREATE POLICY "trip_members_delete" ON trip_members
  FOR DELETE USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

