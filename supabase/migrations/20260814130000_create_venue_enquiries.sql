-- Venue Hire slice 2: an enquiry is its own record, separate from a booking.
--
-- Until now a public request was written straight into venue_bookings as
-- Pending, so an unvetted enquiry already occupied the calendar and the overlap
-- check. Enquiries now land here, get vetted, and only become a booking once a
-- coordinator accepts one.
--
-- Existing source='public' venue_bookings rows are deliberately left alone -
-- this is a cut-over from today, not a backfill. submit_venue_request stays in
-- place for the same reason; the app stops calling it from this migration on.

create table if not exists public.venue_enquiries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- The workspace owner on a public submission; the staff member on a manual one.
  user_id uuid not null,

  event_name text not null,
  event_type text not null default '',
  organisation text not null default '',
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null default '',

  is_for_profit boolean not null default false,
  is_ticketed boolean not null default false,
  expected_attendance integer null,

  preferred_start timestamp with time zone null,
  preferred_end timestamp with time zone null,
  alternate_dates text not null default '',
  setup_notes text not null default '',

  -- Spaces of interest. An enquirer can want the auditorium and the foyer and
  -- the kitchen; which spaces are actually granted is decided at booking time.
  space_ids uuid[] not null default '{}',

  description text not null default '',
  av_needs text not null default '',
  catering_plan text not null default '',
  insurance_status text not null default 'Unknown'
    check (insurance_status in ('Unknown', 'Has cover', 'Needs cover')),
  heard_about text not null default '',

  status text not null default 'New'
    check (status in ('New', 'In review', 'Awaiting info', 'Accepted', 'Declined')),
  source text not null default 'public' check (source in ('public', 'staff')),

  -- Vetting checklist. Booleans are nullable on purpose: null means "not yet
  -- assessed", which is different from a considered no.
  vetting_values_aligned boolean null,
  vetting_has_restricted_content boolean null,
  vetting_can_deliver boolean null,
  vetting_damage_risk text not null default ''
    check (vetting_damage_risk in ('', 'Low', 'Medium', 'High')),
  vetting_reputational_risk text not null default ''
    check (vetting_reputational_risk in ('', 'Low', 'Medium', 'High')),
  vetting_notes text not null default '',

  decline_reason text not null default '',
  -- Set when an accepted enquiry is turned into a booking, so the two stay linked.
  converted_booking_id uuid null references public.venue_bookings(id) on delete set null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_enquiries_event_name_length check (char_length(event_name) <= 200),
  constraint venue_enquiries_contact_name_length check (char_length(contact_name) <= 200),
  constraint venue_enquiries_contact_email_length check (char_length(contact_email) <= 320),
  constraint venue_enquiries_contact_phone_length check (char_length(contact_phone) <= 50),
  constraint venue_enquiries_organisation_length check (char_length(organisation) <= 200),
  constraint venue_enquiries_event_type_length check (char_length(event_type) <= 80),
  constraint venue_enquiries_description_length check (char_length(description) <= 4000),
  constraint venue_enquiries_av_needs_length check (char_length(av_needs) <= 2000),
  constraint venue_enquiries_catering_length check (char_length(catering_plan) <= 2000),
  constraint venue_enquiries_alternate_dates_length check (char_length(alternate_dates) <= 1000),
  constraint venue_enquiries_setup_notes_length check (char_length(setup_notes) <= 1000),
  constraint venue_enquiries_heard_about_length check (char_length(heard_about) <= 200),
  constraint venue_enquiries_vetting_notes_length check (char_length(vetting_notes) <= 4000),
  constraint venue_enquiries_decline_reason_length check (char_length(decline_reason) <= 4000),
  constraint venue_enquiries_attendance_positive check (expected_attendance is null or expected_attendance >= 0),
  constraint venue_enquiries_dates_ordered
    check (preferred_start is null or preferred_end is null or preferred_end > preferred_start)
);

-- Saved replies the coordinator picks from when declining or asking for more
-- information, so the same answer does not get rewritten every time.
create table if not exists public.venue_reply_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  kind text not null default 'Decline' check (kind in ('Decline', 'More info')),
  body text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint venue_reply_templates_name_length check (char_length(name) <= 120),
  constraint venue_reply_templates_body_length check (char_length(body) <= 4000)
);

create index if not exists venue_enquiries_workspace_status_idx
  on public.venue_enquiries(workspace_id, status, created_at desc);

create index if not exists venue_enquiries_workspace_created_idx
  on public.venue_enquiries(workspace_id, created_at desc);

create index if not exists venue_reply_templates_workspace_idx
  on public.venue_reply_templates(workspace_id, kind, name);

alter table public.venue_enquiries enable row level security;
alter table public.venue_reply_templates enable row level security;

do $$
declare
  target record;
begin
  for target in
    select unnest(array['venue_enquiries', 'venue_reply_templates']) as table_name
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

/*
 * Anonymous submission. Takes a jsonb payload rather than twenty positional
 * arguments - the form grows over time and positional drift is a real bug
 * source. Every field is read, trimmed, and length-checked here rather than
 * trusted: this is the trust boundary.
 *
 * status, source and workspace are forced by the function. A submitter cannot
 * pre-approve their own enquiry or aim it at another workspace.
 */
create or replace function public.submit_venue_enquiry(
  request_token text,
  payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_workspace_id uuid;
  target_owner_id uuid;
  requested_spaces uuid[];
  event_name text;
  contact_name text;
  contact_email text;
  preferred_start timestamp with time zone;
  preferred_end timestamp with time zone;
  insurance_status text;
  expected_attendance integer;
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

  if (
    select count(*) from public.venue_enquiries e
    where e.workspace_id = target_workspace_id
      and e.source = 'public'
      and e.created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Too many requests have come in recently. Please try again later.';
  end if;

  event_name := trim(coalesce(payload->>'event_name', ''));
  contact_name := trim(coalesce(payload->>'contact_name', ''));
  contact_email := trim(coalesce(payload->>'contact_email', ''));

  if event_name = '' or contact_name = '' or contact_email = '' then
    raise exception 'Please fill in the required fields.';
  end if;

  if length(event_name) > 200 or length(contact_name) > 200 or length(contact_email) > 320 then
    raise exception 'One of your answers is too long. Please shorten it.';
  end if;

  preferred_start := (payload->>'preferred_start')::timestamp with time zone;
  preferred_end := (payload->>'preferred_end')::timestamp with time zone;

  if preferred_start is not null and preferred_end is not null and preferred_end <= preferred_start then
    raise exception 'The end time must be after the start time.';
  end if;

  -- Only spaces that belong to this workspace and are bookable are kept; anything
  -- else in the payload is silently dropped rather than trusted.
  select coalesce(array_agg(s.id), '{}')
  into requested_spaces
  from public.venue_spaces s
  where s.workspace_id = target_workspace_id
    and s.is_active
    and s.id = any (
      select (jsonb_array_elements_text(coalesce(payload->'space_ids', '[]'::jsonb)))::uuid
    );

  insurance_status := coalesce(payload->>'insurance_status', 'Unknown');
  if insurance_status not in ('Unknown', 'Has cover', 'Needs cover') then
    insurance_status := 'Unknown';
  end if;

  expected_attendance := nullif(payload->>'expected_attendance', '')::integer;
  if expected_attendance is not null and expected_attendance < 0 then
    expected_attendance := null;
  end if;

  insert into public.venue_enquiries (
    workspace_id, user_id,
    event_name, event_type, organisation,
    contact_name, contact_email, contact_phone,
    is_for_profit, is_ticketed, expected_attendance,
    preferred_start, preferred_end, alternate_dates, setup_notes,
    space_ids, description, av_needs, catering_plan,
    insurance_status, heard_about,
    status, source
  ) values (
    target_workspace_id, target_owner_id,
    event_name,
    left(trim(coalesce(payload->>'event_type', '')), 80),
    left(trim(coalesce(payload->>'organisation', '')), 200),
    contact_name, contact_email,
    left(trim(coalesce(payload->>'contact_phone', '')), 50),
    coalesce((payload->>'is_for_profit')::boolean, false),
    coalesce((payload->>'is_ticketed')::boolean, false),
    expected_attendance,
    preferred_start, preferred_end,
    left(trim(coalesce(payload->>'alternate_dates', '')), 1000),
    left(trim(coalesce(payload->>'setup_notes', '')), 1000),
    requested_spaces,
    left(trim(coalesce(payload->>'description', '')), 4000),
    left(trim(coalesce(payload->>'av_needs', '')), 2000),
    left(trim(coalesce(payload->>'catering_plan', '')), 2000),
    insurance_status,
    left(trim(coalesce(payload->>'heard_about', '')), 200),
    'New', 'public'
  );
exception
  when invalid_text_representation or datetime_field_overflow then
    -- A malformed date or number in the payload is the submitter's mistake, not
    -- a server fault, and must not leak Postgres internals to an anonymous caller.
    raise exception 'Some of your answers could not be read. Please check the dates and numbers.';
end $$;

revoke all on function public.submit_venue_enquiry(text, jsonb) from public;
grant execute on function public.submit_venue_enquiry(text, jsonb) to anon, authenticated;
