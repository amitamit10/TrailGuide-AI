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
