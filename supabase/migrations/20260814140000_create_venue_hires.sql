-- Venue Hire slice 3: the parent record.
--
-- A venue_booking is one space for one contiguous stretch of time. A real hire
-- is often several of those: setup Wednesday in the auditorium, registration
-- Thursday in the foyer, competition Friday and Saturday across both. Until now
-- those were unrelated rows with no way to say they are one event, one hirer,
-- one price.
--
-- venue_hires is that parent. hire_id is nullable on venue_bookings, so every
-- existing standalone booking keeps working exactly as it does today.

create table if not exists public.venue_hires (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,

  name text not null,
  event_type text not null default '',

  hirer_contact_id uuid null references public.service_contacts(id) on delete set null,
  hirer_name text not null default '',
  hirer_email text not null default '',
  hirer_phone text not null default '',
  -- The person on site on the day, who is often not the person who booked.
  onsite_contact_name text not null default '',
  onsite_contact_phone text not null default '',

  status text not null default 'Draft'
    check (status in ('Draft', 'Confirmed', 'Completed', 'Cancelled')),

  -- The enquiry this came from, when it came from one. Set null on delete so
  -- clearing out old enquiries never destroys a live hire.
  enquiry_id uuid null references public.venue_enquiries(id) on delete set null,

  notes text not null default '',

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_hires_name_length check (char_length(name) <= 200),
  constraint venue_hires_event_type_length check (char_length(event_type) <= 80),
  constraint venue_hires_hirer_name_length check (char_length(hirer_name) <= 200),
  constraint venue_hires_hirer_email_length check (char_length(hirer_email) <= 320),
  constraint venue_hires_hirer_phone_length check (char_length(hirer_phone) <= 50),
  constraint venue_hires_onsite_name_length check (char_length(onsite_contact_name) <= 200),
  constraint venue_hires_onsite_phone_length check (char_length(onsite_contact_phone) <= 50),
  constraint venue_hires_notes_length check (char_length(notes) <= 4000)
);

-- A booking that belongs to a hire. Deleting the hire releases its bookings
-- rather than deleting them - a booking still occupies the building either way.
alter table public.venue_bookings
  add column if not exists hire_id uuid null references public.venue_hires(id) on delete set null;

create index if not exists venue_hires_workspace_status_idx
  on public.venue_hires(workspace_id, status, created_at desc);

create index if not exists venue_hires_enquiry_idx
  on public.venue_hires(enquiry_id)
  where enquiry_id is not null;

create index if not exists venue_bookings_hire_idx
  on public.venue_bookings(hire_id)
  where hire_id is not null;

alter table public.venue_hires enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venue_hires'
      and policyname = 'Workspace members manage venue records'
  ) then
    create policy "Workspace members manage venue records"
      on public.venue_hires
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = venue_hires.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = venue_hires.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;
