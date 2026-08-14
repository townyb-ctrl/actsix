-- Venue Hire slice 1: a workspace-editable resource inventory (tables, chairs,
-- AV, kitchen equipment) that spaces draw from, plus the space attributes the
-- hire spec needs (standing vs seated capacity, floor plan, setup windows,
-- food rule, staff-only zones).
--
-- Replaces the hard-coded VENUE_SPACE_FEATURES list in the app. Existing
-- venue_spaces.features strings are seeded as resources and linked below.

create table if not exists public.venue_resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  category text not null default '',
  -- How many the church owns in total. 0 means "not counted" rather than "none":
  -- some resources (a projector rig) are never tallied.
  quantity integer not null default 0,
  unit text not null default '',
  -- Included in the base hire fee, or charged on top.
  is_included boolean not null default true,
  unit_price numeric(10,2) not null default 0,
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint venue_resources_name_length check (char_length(name) <= 120),
  constraint venue_resources_category_length check (char_length(category) <= 60),
  constraint venue_resources_unit_length check (char_length(unit) <= 30),
  constraint venue_resources_notes_length check (char_length(notes) <= 2000),
  constraint venue_resources_quantity_positive check (quantity >= 0)
);

-- Which resources a space comes with by default. A resource can belong to many
-- spaces (stackable chairs) or to none (bookable separately).
create table if not exists public.venue_space_resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  space_id uuid not null references public.venue_spaces(id) on delete cascade,
  resource_id uuid not null references public.venue_resources(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamp with time zone not null default now(),
  constraint venue_space_resources_quantity_positive check (quantity >= 0),
  unique (space_id, resource_id)
);

alter table public.venue_spaces
  add column if not exists standing_capacity integer null,
  add column if not exists seated_capacity integer null,
  add column if not exists floor_plan_url text null,
  add column if not exists hireable_standalone boolean not null default true,
  add column if not exists setup_minutes integer not null default 0,
  add column if not exists packdown_minutes integer not null default 0,
  add column if not exists food_allowed boolean not null default true,
  -- Staff-only areas (offices, kitchen, specific bathrooms) that need closing
  -- off during a hire rather than being hired out.
  add column if not exists is_restricted_zone boolean not null default false;

create index if not exists venue_resources_workspace_idx
  on public.venue_resources(workspace_id, name);

create index if not exists venue_space_resources_space_idx
  on public.venue_space_resources(space_id);

create index if not exists venue_space_resources_resource_idx
  on public.venue_space_resources(resource_id);

alter table public.venue_resources enable row level security;
alter table public.venue_space_resources enable row level security;

do $$
declare
  target record;
begin
  for target in
    select unnest(array['venue_resources', 'venue_space_resources']) as table_name
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

-- Seed one resource per distinct feature string already recorded on a space.
-- Postgres has no min() for uuid, so the oldest space's creator is picked with
-- array_agg - it keeps the row attributable when several spaces in a workspace
-- were created by different people.
insert into public.venue_resources (workspace_id, user_id, name, category)
select
  s.workspace_id,
  (array_agg(s.user_id order by s.created_at, s.id))[1],
  f.feature,
  'Space feature'
from public.venue_spaces s
cross join lateral unnest(s.features) as f(feature)
where not exists (
  select 1 from public.venue_resources r
  where r.workspace_id = s.workspace_id
    and r.name = f.feature
)
group by s.workspace_id, f.feature;

insert into public.venue_space_resources (workspace_id, space_id, resource_id)
select s.workspace_id, s.id, r.id
from public.venue_spaces s
cross join lateral unnest(s.features) as f(feature)
join public.venue_resources r
  on r.workspace_id = s.workspace_id
 and r.name = f.feature
on conflict (space_id, resource_id) do nothing;

-- venue_spaces.features is left in place, unread by the app from this point on.
-- It is the rollback path for the seed above; drop it in a later migration once
-- the inventory has been in production use.
comment on column public.venue_spaces.features is
  'Deprecated 2026-08-14: superseded by venue_space_resources. Retained for rollback only.';
