alter table public.training_courses
  add column if not exists cover_image_url text not null default '';
