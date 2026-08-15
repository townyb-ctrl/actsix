-- Venue Hire slice 15: signs, AV presets, and kit that leaves the cupboard.
--
-- Three things the spec asks for, built on what already exists where possible:
--
-- 1. A sign library the church owns, tracking which signs physically exist and
--    which need reprinting - the recurring "we thought we had that sign" problem.
-- 2. Named AV routing presets, so "the usual for a conference" is a record
--    rather than a conversation with whoever set it up last time.
-- 3. A check-out log for kit. venue_resources (slice 1) is already the asset
--    register, so this is a log against it rather than a second inventory.

create table if not exists public.venue_signs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,

  name text not null,
  -- What the sign says, so it can be reprinted without redesigning it.
  body text not null default '',
  placement text not null default '',

  -- The distinction that matters: a sign that exists is carried out of a
  -- cupboard, a sign that does not has to be printed before the day.
  exists_physically boolean not null default false,
  needs_reprint boolean not null default false,
  last_printed_on date null,

  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_signs_name_length check (char_length(name) between 1 and 200),
  constraint venue_signs_body_length check (char_length(body) <= 1000),
  unique (workspace_id, name)
);

create table if not exists public.venue_hire_signs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  sign_id uuid not null references public.venue_signs(id) on delete cascade,
  user_id uuid not null,

  quantity integer not null default 1,
  -- Overrides the library placement for this hire only.
  placement text not null default '',
  prepared boolean not null default false,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_hire_signs_quantity_positive check (quantity > 0),
  unique (hire_id, sign_id)
);

create table if not exists public.venue_av_presets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,

  name text not null,
  -- Free text rather than a foreign key: event types are typed on a hire, not
  -- a table, and forcing a list here would be a second source of truth.
  event_type text not null default '',
  space_id uuid null references public.venue_spaces(id) on delete set null,

  routing text not null default '',
  changeover_steps text not null default '',

  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_av_presets_name_length check (char_length(name) between 1 and 200),
  unique (workspace_id, name)
);

alter table public.venue_hires
  add column if not exists av_preset_id uuid null references public.venue_av_presets(id) on delete set null,
  add column if not exists walkie_channels text not null default '';

create table if not exists public.venue_resource_checkouts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  resource_id uuid not null references public.venue_resources(id) on delete cascade,
  user_id uuid not null,

  quantity integer not null default 1,
  taken_by text not null default '',
  taken_at timestamp with time zone not null default now(),

  -- Null until it comes back. This is the whole point of the log.
  returned_at timestamp with time zone null,
  condition_note text not null default '',

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_resource_checkouts_quantity_positive check (quantity > 0),
  constraint venue_resource_checkouts_condition_length check (char_length(condition_note) <= 1000)
);

create index if not exists venue_hire_signs_hire_idx on public.venue_hire_signs(hire_id);
create index if not exists venue_av_presets_workspace_idx
  on public.venue_av_presets(workspace_id, is_active);
create index if not exists venue_resource_checkouts_hire_idx
  on public.venue_resource_checkouts(hire_id, returned_at);

alter table public.venue_signs enable row level security;
alter table public.venue_hire_signs enable row level security;
alter table public.venue_av_presets enable row level security;
alter table public.venue_resource_checkouts enable row level security;

do $$
declare
  target text;
begin
  foreach target in array array[
    'venue_signs', 'venue_hire_signs', 'venue_av_presets', 'venue_resource_checkouts'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = target
        and policyname = 'Workspace members manage venue records'
    ) then
      execute format(
        'create policy "Workspace members manage venue records"
           on public.%I
           for all
           to authenticated
           using (
             exists (
               select 1 from public.workspace_members wm
               where wm.workspace_id = %I.workspace_id
                 and wm.auth_user_id = auth.uid()
                 and wm.status = ''active''
             )
           )
           with check (
             exists (
               select 1 from public.workspace_members wm
               where wm.workspace_id = %I.workspace_id
                 and wm.auth_user_id = auth.uid()
                 and wm.status = ''active''
             )
           )',
        target, target, target
      );
    end if;
  end loop;
end $$;
