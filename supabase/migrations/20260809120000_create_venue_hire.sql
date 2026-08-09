create table if not exists public.venue_spaces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  description text not null default '',
  capacity integer null,
  hourly_rate numeric(10,2) not null default 0,
  daily_rate numeric(10,2) not null default 0,
  color text not null default '',
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.venue_bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  space_id uuid not null references public.venue_spaces(id) on delete restrict,
  title text not null,
  booking_type text not null default 'internal' check (booking_type in ('internal', 'external')),
  hirer_contact_id uuid null references public.service_contacts(id) on delete set null,
  hirer_name text not null default '',
  hirer_email text not null default '',
  hirer_phone text not null default '',
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Cancelled')),
  quoted_fee numeric(10,2) not null default 0,
  deposit_amount numeric(10,2) not null default 0,
  payment_status text not null default 'Not applicable'
    check (payment_status in ('Not applicable', 'Unpaid', 'Deposit paid', 'Paid')),
  source text not null default 'staff' check (source in ('staff', 'public')),
  notes text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint venue_bookings_ends_after_starts check (ends_at > starts_at)
);

alter table public.workspaces
  add column if not exists venue_request_token text null;

create unique index if not exists workspaces_venue_request_token_idx
  on public.workspaces(venue_request_token)
  where venue_request_token is not null;

create index if not exists venue_spaces_workspace_idx
  on public.venue_spaces(workspace_id, name);

create index if not exists venue_bookings_workspace_start_idx
  on public.venue_bookings(workspace_id, starts_at);

create index if not exists venue_bookings_space_start_idx
  on public.venue_bookings(space_id, starts_at);

create index if not exists venue_bookings_status_idx
  on public.venue_bookings(workspace_id, status);

alter table public.venue_spaces enable row level security;
alter table public.venue_bookings enable row level security;

do $$
declare
  target record;
begin
  for target in
    select unnest(array['venue_spaces', 'venue_bookings']) as table_name
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = target.table_name
        and policyname = 'Workspace members manage venue records'
    ) then
      execute format($f$
        create policy %I on public.%I
          for all
          to authenticated
          using (
            exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = %I.workspace_id
                and wm.auth_user_id = auth.uid()
                and wm.status = 'active'
            )
          )
          with check (
            exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = %I.workspace_id
                and wm.auth_user_id = auth.uid()
                and wm.status = 'active'
            )
          )
      $f$, 'Workspace members manage venue records', target.table_name, target.table_name, target.table_name);
    end if;
  end loop;
end $$;

create or replace function public.get_venue_request_spaces(request_token text)
returns table (id uuid, name text, description text, capacity integer)
language sql
security definer
set search_path = public
as $$
  select s.id, s.name, s.description, s.capacity
  from public.venue_spaces s
  join public.workspaces w on w.id = s.workspace_id
  where w.venue_request_token is not null
    and w.venue_request_token = request_token
    and s.is_active
  order by s.name;
$$;

create or replace function public.submit_venue_request(
  request_token text,
  target_space_id uuid,
  booking_title text,
  hirer_name text,
  hirer_email text,
  hirer_phone text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  request_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  target_owner_id uuid;
begin
  if request_token is null or length(trim(request_token)) = 0 then
    raise exception 'This request link is no longer active.';
  end if;

  select w.id, w.owner_user_id into target_workspace_id, target_owner_id
  from public.workspaces w
  where w.venue_request_token = request_token;

  if target_workspace_id is null then
    raise exception 'This request link is no longer active.';
  end if;

  if not exists (
    select 1 from public.venue_spaces s
    where s.id = target_space_id
      and s.workspace_id = target_workspace_id
      and s.is_active
  ) then
    raise exception 'That space is not available for requests.';
  end if;

  if starts_at is null or ends_at is null or ends_at <= starts_at then
    raise exception 'The end time must be after the start time.';
  end if;

  if length(trim(coalesce(booking_title, ''))) = 0
     or length(trim(coalesce(hirer_name, ''))) = 0
     or length(trim(coalesce(hirer_email, ''))) = 0 then
    raise exception 'Please fill in the required fields.';
  end if;

  insert into public.venue_bookings (
    workspace_id, user_id, space_id, title, booking_type,
    hirer_name, hirer_email, hirer_phone,
    starts_at, ends_at, status, source, notes
  ) values (
    target_workspace_id, target_owner_id, target_space_id, trim(booking_title), 'external',
    trim(hirer_name), trim(hirer_email), trim(coalesce(hirer_phone, '')),
    starts_at, ends_at, 'Pending', 'public', coalesce(request_notes, '')
  );
end $$;

revoke all on function public.get_venue_request_spaces(text) from public;
revoke all on function public.submit_venue_request(
  text, uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, text
) from public;

grant execute on function public.get_venue_request_spaces(text) to anon, authenticated;
grant execute on function public.submit_venue_request(
  text, uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, text
) to anon, authenticated;
