create extension if not exists pgcrypto with schema extensions;

create or replace function public.crypt(password text, salt text)
returns text
language sql
immutable
strict
set search_path = extensions, pg_temp
as $$
  select extensions.crypt(password, salt);
$$;

create or replace function public.gen_salt(salt_type text)
returns text
language sql
volatile
strict
set search_path = extensions, pg_temp
as $$
  select extensions.gen_salt(salt_type);
$$;
