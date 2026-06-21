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
