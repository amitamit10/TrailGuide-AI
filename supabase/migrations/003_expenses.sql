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
  using (auth.uid() = user_id);

create index if not exists expenses_trip_id_idx on expenses(trip_id);
