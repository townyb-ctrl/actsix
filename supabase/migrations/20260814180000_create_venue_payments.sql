-- Venue Hire slice 10: what was actually paid, and the contract.
--
-- Quote lines say what a hire owes. Nothing until now recorded what arrived,
-- so an external hire had no deposit-paid or balance-outstanding anywhere.
--
-- Payments are recorded by staff. ACTSIX has no payment provider and takes no
-- money; this is a ledger of what landed in the church's account.

create table if not exists public.venue_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hire_id uuid not null references public.venue_hires(id) on delete cascade,
  user_id uuid not null,

  -- 'Payment' counts against what the hire owes. 'Bond' is held and owed back,
  -- so it never reduces the balance.
  kind text not null default 'Payment' check (kind in ('Payment', 'Bond')),

  -- Deliberately signed. A refund is a negative row of the same kind rather
  -- than a third kind, so "what have we received" stays a single sum and a
  -- returned bond cannot be mistaken for income.
  amount numeric(10,2) not null,

  paid_on date not null default current_date,
  method text not null default 'EFT' check (method in ('EFT', 'Cash', 'Card', 'Other')),
  reference text not null default '',
  notes text not null default '',

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint venue_payments_amount_nonzero check (amount <> 0),
  constraint venue_payments_reference_length check (char_length(reference) <= 120),
  constraint venue_payments_notes_length check (char_length(notes) <= 500)
);

create index if not exists venue_payments_hire_idx
  on public.venue_payments(hire_id, paid_on desc);

alter table public.venue_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venue_payments'
      and policyname = 'Workspace members manage venue records'
  ) then
    create policy "Workspace members manage venue records"
      on public.venue_payments
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = venue_payments.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      )
      with check (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = venue_payments.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;

-- Contract wording. The workspace holds the church's standard clauses so they
-- are written once; each hire takes a copy at contract time, which can then be
-- edited for that hire without changing the standard for everyone else.
alter table public.workspaces
  add column if not exists venue_contract_clauses text not null default '';

alter table public.venue_hires
  add column if not exists contract_clauses text not null default '',
  add column if not exists contract_signed_on date null,
  add column if not exists contract_signed_by text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'venue_hires_contract_signed_by_length'
  ) then
    alter table public.venue_hires
      add constraint venue_hires_contract_signed_by_length
      check (char_length(contract_signed_by) <= 200);
  end if;
end $$;
