-- Venue Hire: a note the hirer is meant to read.
--
-- venue_hires.notes has always been staff-facing in practice - the portal
-- function never returned it - but nothing said so on the field, and there was
-- no field at all for the other half: the sentence somebody actually wants the
-- hirer to see when they open their link ("load in through the side door,
-- Pieter has the keys from 06:00"). Coordinators had nowhere to put it, so it
-- went in an email that then lived only in one person's sent folder.
--
-- Two columns rather than a visibility flag on one: these are different pieces
-- of writing with different audiences, and a hire usually wants both at once.
-- A flag would also make "who can read this" a thing you set rather than a
-- thing you can see.

alter table public.venue_hires
  add column if not exists hirer_notes text not null default '';

comment on column public.venue_hires.hirer_notes is
  'Shown to the hirer on their portal page. Never put anything internal here.';

comment on column public.venue_hires.notes is
  'Staff only. Never returned by get_venue_hire_portal and never printed on the quote.';

/*
 * Re-declared to add exactly one field: hirer_notes.
 *
 * The column list stays written out by hand, for the reason the original
 * migration gives - a column added later must not leak by default. Everything
 * deliberately absent stays absent: internal notes, vetting answers, the
 * debrief, lessons learned, damage findings, who is rostered, and every other
 * hire in the workspace.
 */
create or replace function public.get_venue_hire_portal(portal_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.venue_hires%rowtype;
  result jsonb;
begin
  if portal_token is null or length(trim(portal_token)) < 32 then
    raise exception 'This link is no longer active.';
  end if;

  select * into target
  from public.venue_hires h
  where h.portal_token = get_venue_hire_portal.portal_token
    and h.portal_enabled;

  if target.id is null then
    raise exception 'This link is no longer active.';
  end if;

  select jsonb_build_object(
    'hire', jsonb_build_object(
      'name', target.name,
      'event_type', target.event_type,
      'status', target.status,
      'quote_status', target.quote_status,
      'payment_terms', target.payment_terms,
      'contract_clauses', target.contract_clauses,
      'contract_signed_on', target.contract_signed_on,
      'contract_signed_by', target.contract_signed_by,
      'hirer_name', target.hirer_name,
      'hirer_notes', target.hirer_notes
    ),
    'workspace', (
      select jsonb_build_object('name', w.name)
      from public.workspaces w
      where w.id = target.workspace_id
    ),
    'bookings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'title', b.title,
          'starts_at', b.starts_at,
          'ends_at', b.ends_at,
          'status', b.status,
          'space_name', s.name
        )
        order by b.starts_at
      )
      from public.venue_bookings b
      left join public.venue_spaces s on s.id = b.space_id
      where b.hire_id = target.id
        and b.status <> 'Cancelled'
    ), '[]'::jsonb),
    'quote_lines', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'kind', q.kind,
          'description', q.description,
          'quantity', q.quantity,
          'unit_price', q.unit_price
        )
        order by q.sort_order, q.created_at
      )
      from public.venue_quote_lines q
      where q.hire_id = target.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'kind', p.kind,
          'amount', p.amount,
          'paid_on', p.paid_on,
          'method', p.method
        )
        order by p.paid_on
      )
      from public.venue_payments p
      where p.hire_id = target.id
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;

revoke all on function public.get_venue_hire_portal(text) from public;
grant execute on function public.get_venue_hire_portal(text) to anon, authenticated;
