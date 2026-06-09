alter table public.training_lessons
  add column if not exists media_items jsonb not null default '[]'::jsonb;
