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
