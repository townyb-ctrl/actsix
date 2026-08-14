-- Venue Hire slice 4: quoting.
--
-- Money belongs to the hire, not to a booking. A booking is in-house use of a
-- space and carries no cost; a hire is an external event and is priced with
-- quote lines. That split comes from how the church actually works: internal
-- bookings are never invoiced, external ones always are.
--
-- Nothing is dropped or migrated. venue_bookings still has quoted_fee,
-- deposit_amount, payment_status, technician_fee and coffee_fee, and the rows
-- already carrying values keep them. New UI simply stops writing them.

create table if not exists public.venue_quote_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  user_id uuid not null,

  -- What sort of line this is. Deposits and bonds are held rather than earned,
  -- so they are totalled separately from everything the hire actually charges.
  kind text not null default 'Venue'
    check (kind in (
      'Venue', 'Resource', 'Staff', 'Insurance', 'Cleaning', 'Damage waiver',
      'Deposit', 'Security bond', 'Discount', 'Other'
    )),
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  -- Keeps hand-ordered lines stable; ties break on created_at.
  sort_order integer not null default 0,
  notes text not null default '',

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_quote_lines_description_length check (char_length(description) <= 200),
  constraint venue_quote_lines_notes_length check (char_length(notes) <= 1000),
  constraint venue_quote_lines_quantity_positive check (quantity >= 0)
);

alter table public.venue_hires
  add column if not exists quote_status text not null default 'Draft'
    check (quote_status in ('Draft', 'Sent', 'Accepted', 'Declined')),
  add column if not exists quote_sent_at timestamp with time zone null,
  -- Free text so a church can write "50% on signature, balance 7 days before".
  add column if not exists payment_terms text not null default '';

-- Guarded because ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS, and this
-- migration has to stay re-runnable like the rest.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'venue_hires_payment_terms_length'
  ) then
    alter table public.venue_hires
      add constraint venue_hires_payment_terms_length check (char_length(payment_terms) <= 1000);
  end if;
end $$;

create index if not exists venue_quote_lines_hire_idx
  on public.venue_quote_lines(hire_id, sort_order, created_at);

alter table public.venue_quote_lines enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venue_quote_lines'
      and policyname = 'Workspace members manage venue records'
  ) then
    create policy "Workspace members manage venue records"
      on public.venue_quote_lines
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = venue_quote_lines.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = venue_quote_lines.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;
