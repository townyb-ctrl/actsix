-- Venue Hire slice 8: a page the hirer can open without an account.
--
-- Decision (Q4): a bearer token in the URL, not a real user account. An
-- external hirer should never end up in auth.users of a church's internal
-- tool - it would mean password resets, an invite flow, and a login surface
-- that exists solely for people who use it twice a year. The token is the same
-- shape of trust as the public request link that already exists.
--
-- Nothing anonymous ever touches a table directly. Both entry points are
-- security definer functions that take the token, hand back only what a hirer
-- is allowed to see, and are granted to anon explicitly.

alter table public.venue_hires
  add column if not exists portal_token text null,
  add column if not exists portal_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'venue_hires_portal_token_key'
  ) then
    alter table public.venue_hires
      add constraint venue_hires_portal_token_key unique (portal_token);
  end if;
end $$;

/*
 * A fresh token. Two uuids of hex is 256 bits, which is far past guessing, and
 * needs no extension - pgcrypto's gen_random_bytes is not assumed to be there.
 */
create or replace function public.new_venue_portal_token()
returns text
language sql
volatile
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

/*
 * Everything the hirer's page shows, and nothing else.
 *
 * Deliberately absent: internal notes, vetting answers, the debrief, lessons
 * learned, damage findings, who is rostered, and every other hire in the
 * workspace. The function returns one hire, selected by a token nobody can
 * enumerate, with the columns written out by hand rather than select *, so a
 * column added later cannot leak by default.
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
      'hirer_name', target.hirer_name
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

/*
 * The hirer accepting the quote and its terms.
 *
 * Records a name typed by whoever holds the link. This is an agreement in the
 * same weight as a returned email, not a legal e-signature - ACTSIX takes on no
 * e-sign provider, and the printed contract stays the wet-signature path.
 *
 * Only ever moves a quote from Sent to Accepted or Declined. A quote nobody has
 * sent yet cannot be accepted, and an accepted one cannot be silently changed
 * by re-posting the form.
 */
create or replace function public.respond_to_venue_quote(
  portal_token text,
  decision text,
  signed_by text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
  current_status text;
  clean_name text;
begin
  if portal_token is null or length(trim(portal_token)) < 32 then
    raise exception 'This link is no longer active.';
  end if;

  if decision not in ('Accepted', 'Declined') then
    raise exception 'Choose whether you are accepting or declining.';
  end if;

  clean_name := left(trim(coalesce(signed_by, '')), 200);
  if decision = 'Accepted' and clean_name = '' then
    raise exception 'Please type your name to accept.';
  end if;

  select h.id, h.quote_status into target_id, current_status
  from public.venue_hires h
  where h.portal_token = respond_to_venue_quote.portal_token
    and h.portal_enabled;

  if target_id is null then
    raise exception 'This link is no longer active.';
  end if;

  if current_status <> 'Sent' then
    raise exception 'This quote is not waiting for an answer.';
  end if;

  update public.venue_hires
  set quote_status = decision,
      contract_signed_on = case when decision = 'Accepted' then current_date else contract_signed_on end,
      contract_signed_by = case when decision = 'Accepted' then clean_name else contract_signed_by end,
      updated_at = now()
  where id = target_id;
end $$;

revoke all on function public.get_venue_hire_portal(text) from public;
revoke all on function public.respond_to_venue_quote(text, text, text) from public;
grant execute on function public.get_venue_hire_portal(text) to anon, authenticated;
grant execute on function public.respond_to_venue_quote(text, text, text) to anon, authenticated;
-- Token minting stays with signed-in staff; anon has no reason to call it.
--
-- anon is revoked by name, not just via PUBLIC. Supabase's default privileges
-- grant execute on new functions in `public` to anon directly, and revoking
-- PUBLIC does not touch that separate grant.
revoke all on function public.new_venue_portal_token() from public;
revoke all on function public.new_venue_portal_token() from anon;
grant execute on function public.new_venue_portal_token() to authenticated;
