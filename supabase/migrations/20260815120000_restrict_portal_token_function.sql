-- Close a privilege that was never intended: anon could execute
-- new_venue_portal_token().
--
-- Why the original revoke missed it: Supabase ships default privileges that
-- grant execute on newly created functions in `public` to anon, authenticated
-- and service_role directly. `revoke all ... from public` removes the PUBLIC
-- pseudo-role's grant, which is not the same grant, so the one held by anon by
-- name survived it. A role that has to be excluded must be revoked by name.
--
-- Impact was minimal - the function reads and writes nothing, it concatenates
-- two gen_random_uuid() values, and a token is worthless until an authenticated
-- user stores it on a hire row through RLS. This is least privilege, not an
-- incident.
--
-- The other anon-callable venue functions (get_venue_hire_portal,
-- respond_to_venue_quote, submit_venue_enquiry, get_venue_request_spaces,
-- submit_venue_request) are granted to anon on purpose and are left alone.

revoke all on function public.new_venue_portal_token() from anon;

-- service_role bypasses this anyway, but leaving a grant nobody uses on an
-- anonymous-adjacent role is the habit worth not forming.
revoke all on function public.new_venue_portal_token() from public;
grant execute on function public.new_venue_portal_token() to authenticated;
