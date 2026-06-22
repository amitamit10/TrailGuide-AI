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
