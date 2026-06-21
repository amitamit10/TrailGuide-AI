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
