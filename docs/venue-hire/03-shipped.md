# Venue Hire — what shipped

Written 2026-08-15, when the module was finished. This is the record of what was
built, what was decided, and what was deliberately left out. The gap analysis
([01-gap-analysis.md](01-gap-analysis.md)) and build plan
([02-build-plan.md](02-build-plan.md)) describe the state *before* this work and
are kept as they were.

## Slices

| # | Slice | Branch | Migration |
|---|---|---|---|
| 1 | Resource inventory & richer spaces | `feat/venue-resources` | `20260814120000_create_venue_resources.sql` |
| 2 | Enquiry intake & vetting | `feat/venue-enquiries` | `20260814130000_create_venue_enquiries.sql` |
| 3 | Hires: the parent event | `feat/venue-hires` | `20260814140000_create_venue_hires.sql` |
| 4 | Quoting as line items | `feat/venue-quotes` | `20260814150000_create_venue_quote_lines.sql` |
| 5 | Run sheet | `feat/venue-run-sheet` | `20260814160000_create_venue_run_sheet.sql` |
| 6 | Positions & assignment | `feat/venue-positions` | `20260814170000_create_venue_positions.sql` |
| 10 | Contract & payments | `feat/venue-payments` | `20260814180000_create_venue_payments.sql` |
| 9 | Church-calendar clash detection | `feat/venue-clashes` | `20260814190000_add_calendar_event_space.sql` |
| 11 | Post-event debrief & repeat | `feat/venue-post-event` | `20260814200000_add_venue_hire_debrief.sql` |
| 13 | Cleaning, damage & turnaround | `feat/venue-turnaround` | `20260814210000_create_venue_turnaround.sql` |
| 12 | Reporting | `feat/venue-reporting` | none — reads existing tables |
| 8 | Hirer portal | `feat/venue-portal` | `20260814220000_create_venue_hire_portal.sql` |
| 14 | Safety, security & incidents | `feat/venue-safety` | `20260814230000_create_venue_safety.sql` |
| 15 | Signage & AV presets | `feat/venue-signage` | `20260814240000_create_venue_signage_av.sql` |
| 16 | Mobile event-day view | `feat/venue-event-day` | none — reads existing tables |

Slice 7 (pay rules & timesheets) was retired on 2026-08-14: pay, swaps and leave
are handled in house. The number is left unused rather than renumbering.

## Decisions taken

Answers to the open questions, and the reasoning, so a future reader does not
relitigate them from scratch.

**Q1 — space features.** The fixed four-item `VENUE_SPACE_FEATURES` list became
rows in `venue_resources`, migrated from the existing string arrays.

**Q4 — hirer identity: a bearer token, not accounts.** An external hirer should
never end up in `auth.users` of a church's internal tool; that means an invite
flow, password resets and a login surface existing solely for people who use it
twice a year. The token follows the public request link already in the module.

**Q5 — calendar direction: one-way, not mirrored.** Calendar already reads venue
bookings live. A mirrored copy in `calendar_events` would drift the moment
either side was edited. Slice 9 added the read in the other direction instead.

**Q6 — money model: bookings are in-house and free, hires are external and
priced.** Set by the user on 2026-08-14. Existing bookings were left untouched;
`booking_type` is only derived for new ones, so re-saving an old external
booking cannot zero its fee.

**Q11 — recurring programmes.** No recurrence schema exists. Link groups and
worship practice are detected only if somebody enters them as calendar events
with a space set. The clash panel states how many entries it had to skip rather
than implying the building is free.

**Q12 — payment rails: none.** ACTSIX takes no money. `venue_payments` is a
ledger of what landed in the church's bank account.

**Slice 0 / 17 — no messaging platform, so no automated comms.** The only
outbound channel in the codebase is the Twilio WhatsApp edge function. Building
transactional email is a platform project, not a venue slice. Every feature that
would have used it (decline replies, media chases, feedback requests) stays as
something a human sends.

## Deliberately not built

- **Auto-triage rules for enquiries.** Vetting is a judgement call; scoring it
  would produce a number people argue with.
- **Run-sheet templates per event type.** Cloning a past hire covers the real
  need, and cost nothing extra.
- **`service_instances` in clash detection.** That table has no end time and no
  `workspace_id`, so any check would be date-level guessing across workspaces.
  Fix the table first.
- **A cost side on quote lines.** Damage cost is typed on the debrief; there is
  no per-line cost model, so `Repair` turnaround tasks do not roll up.
- **Auto-recompute of the turnaround window on a late teardown.** Needs a
  scheduler, which the codebase does not have.
- **E-signature.** The portal records a typed name; the printed contract remains
  the wet-signature path. No e-sign dependency was taken on.

## Known ceilings

- `cloneHire` is sequential inserts with no transaction — PostgREST has none
  client-side. A mid-way failure leaves a partial draft; the UI says so and
  navigates to it. Marked with a `ponytail:` comment.
- Supabase's default privileges grant `execute` on every new function in
  `public` to `anon` by name. `revoke all ... from public` does **not** remove
  that grant - a role that must be excluded has to be revoked by name. Found on
  2026-08-15 when `new_venue_portal_token` came back anon-callable; fixed in
  `20260815120000_restrict_portal_token_function.sql`. Worth checking on any
  future function that is meant to be staff-only.
- The portal token has no rate limit on lookup. It is 256 bits of entropy behind
  a `security definer` function, but a determined caller can hammer the endpoint.
- Generated Supabase types (`src/integrations/supabase/types.ts`) still cover no
  venue table, so venue queries use the blessed `(supabase as any)` cast.

## Verification at the time of writing

`npx tsc -p tsconfig.app.json --noEmit`, `npm run lint` (0 errors), `npm test`
(593 tests), and `npm run build` all pass.

**Not verified:** no migration in this module was applied by the agent that
wrote it, and no browser pass was run. Every print sheet, chart and panel is
visually unchecked, as is photo upload against the live storage bucket.
