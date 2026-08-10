alter table public.venue_spaces
  add column if not exists features text[] not null default '{}';
