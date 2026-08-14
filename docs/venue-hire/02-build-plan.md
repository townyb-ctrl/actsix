# Venue Hire — Phase 2 Build Plan

Vertical slices, each independently shippable and each ending in a PR-style summary. Grounded in
[00-audit.md](00-audit.md) and [01-gap-analysis.md](01-gap-analysis.md). Nothing here is started
until the plan and the blocking questions below are settled.

Effort key: **S** ≈ half a day · **M** ≈ 1–2 days · **L** ≈ 3–5 days, at the granularity this
codebase's commits already run at.

## Decisions (2026-08-14)

| # | Question | Decision |
|---|---|---|
| — | Staff pay, swaps, leave, timesheets, payroll | **Out of scope**, handled in house. Slice 6 is assignment only; slice 7 retired |
| Q1 | `VENUE_SPACE_FEATURES` | **Migrate the four strings into inventory rows.** The constant is deleted; existing `venue_spaces.features` values are seeded as `venue_resources` per workspace and linked to their spaces |
| Q2 | Enquiries vs bookings | **New `venue_enquiries` table.** Coordinator vets, then converts into a booking/hire |
| Q2b | Existing `source='public'` rows | **Leave them as bookings**, cut over from the migration date. No backfill |
| Q3 | Dormant `events`/`event_*` tables | **Leave dormant, untouched.** Build venue-owned tables |

Still open, each needed only by the slice that names it: Q4 (hirer identity), Q5 (calendar
direction), Q6 (quote line migration), Q7 (positions table home), Q8 (template scope), Q9
(per-person constraints — default skip), Q10 (portal branding), Q11 (recurring programmes), Q12
(payment rails).

---

## Recommended order, and why it differs from the suggested one

Suggested: catalogue → enquiry intake → quoting → run sheet → staffing → hirer portal.

Two changes, both forced by the audit:

1. **Insert "hire" (the parent event) between enquiry and quoting.** Conflict **C10** — a booking
   is one space × one time range with no parent. The spec's quote (§5), run sheet (§7), staffing
   (§8), portal (§6), debrief (§14) and financial summary all hang off a multi-day, multi-space
   *hire*. Building quoting on top of single bookings means rebuilding it once the parent lands.
   This slice is the spine; it should be third, not implicit.
2. **Move anything that must send a message to the very end, behind its own platform slice.**
   No scheduler and no transactional email exist. Auto-reminders, auto-notices, quote-sent
   tracking and hirer feedback are all blocked on infrastructure, not on venue features. Slice 0
   below decides whether we build that platform at all; until it lands, those features ship as
   "draft it, staff sends it manually", which is honest and useful on its own.

Resulting order:

| # | Slice | Effort | Depends on |
|---|---|---|---|
| 0 | Messaging platform decision (spike, no code) | S | — |
| 1 | Resource inventory & richer spaces | M | — |
| 2 | Enquiry intake & vetting | L | — |
| 3 | Hires: the parent event | L | 1, 2 |
| 4 | Quoting as line items | M | 1, 3 |
| 5 | Run sheet | L | 3 |
| 6 | Positions & assignment (no pay — descoped) | M | 3, 5 |
| 8 | Hirer portal | M | 3, Q4 |
| 9 | Church-calendar clash detection | M | 3, Q5 |
| 10 | Contract, deposit & payment tracking | M | 4 |
| 11 | Post-event: debrief, clone, financial summary | M | 3, 6 |
| 12 | Reporting & dashboard widgets | S | 3, 4 |
| 13 | Cleaning, damage & turnaround | M | 3, 5 |
| 14 | Safety, security & incidents | S | 3 |
| 15 | Signage & AV presets | M | 5 |
| 16 | Mobile event-day view | M | 5, 6 |
| 17 | Automated comms (only if slice 0 says yes) | L | 0, and each feature it serves |

Slice 7 (pay rules & timesheets) was **retired** on 2026-08-14 — pay, swaps and leave are handled
in house. The number is left unused rather than renumbering everything below it.

Slices 1 and 2 are independent of each other and of 3 — either can go first, and they're the two
that deliver value with the least structural risk.

---

## Slice 0 — Messaging platform decision

**Spike. No code. Ends in a written decision, not a PR.**

Scope: decide whether ACTSIX gets (a) transactional email, (b) a scheduler for time-based sends,
neither, or both. Everything in §2 (decline replies), §4 (ministry notices), §6 (7/3/1-day media
chases), §9 (auto-drafts), §12, §14 (feedback requests) depends on the answer. Options: a
Supabase edge function + an email provider (new dependency, new secret) with `pg_cron` or an
external cron hitting the function; reuse the existing `whatsapp-agent` Twilio path; in-app
notifications only (staff only, no hirer reach); or nothing, and every "auto" feature becomes
"draft + staff clicks send".

Deliverable: `docs/venue-hire/03-messaging-decision.md`. **Effort: S.** **Blocking for slice 17
only** — every other slice ships without it, degraded to manual send where the spec said auto.

---

## Slice 1 — Resource inventory & richer spaces (§3)

**Scope.** Workspace-editable resource inventory (tables, chairs, stanchions, dividers, leads,
walkie-talkies, signage stands, AV items, kitchen/cafe equipment) with quantity, included-vs-paid,
and unit price. Space attributes the spec asks for: standing vs seated capacity, floor-plan image
(typed separately from photos), hireable-standalone flag, typical setup/pack-down minutes,
food-allowed flag. Restricted / staff-only zones as a first-class tag on a space.

**Explicitly out of scope for this slice:** "is this item allocated to another event today"
(needs slice 3's parent hire to be meaningful), and per-item pricing feeding a quote (slice 4).

**Files touched**
- New: `supabase/migrations/<ts>_create_venue_resources.sql`
- New: `src/features/venues/api/venueResourcesApi.ts`, `venueResourcesQueries.ts` (+ tests)
- New: `src/features/venues/pages/VenueResourcesPage.tsx`, `src/pages/VenueResources.tsx` shim
- New: `src/features/venues/components/VenueResourceEditorModal.tsx`
- Modify: `VenueSpaceEditorModal.tsx`, `VenueSpacesPage.tsx`, `venueBookings.ts` (space type),
  `src/App.tsx` (one route), `src/components/AppSidebar.tsx` (one nav item)

**New tables:** `venue_resources` (workspace-scoped: name, category, quantity, unit, is_included,
unit_price, notes), `venue_space_resources` (space ↔ resource default allocation).
**Columns added to `venue_spaces`:** `standing_capacity`, `seated_capacity`, `floor_plan_url`,
`hireable_standalone`, `setup_minutes`, `packdown_minutes`, `food_allowed`, `is_restricted_zone`.

**Tests:** api insert/update branching + workspace scoping (mirrors `venuesApi.test.ts`); resource
editor modal validation; space editor renders and saves the new fields.

**Per the Q1 decision**, this slice also deletes `VENUE_SPACE_FEATURES` and seeds the four strings
as `venue_resources` rows per workspace, linked to the spaces that carried them.
`venue_bookings.requested_features` stays a `text[]` of names — the booking modal simply sources
those names from the space's linked resources instead of the constant, so no booking data is
migrated and no booking behaviour changes beyond the list being workspace-editable.

**Effort: M.** **Depends on:** nothing. **Answers needed:** none — cleared to build.

---

## Slice 2 — Enquiry intake & vetting (§2)

**Scope.** A `venue_enquiries` entity distinct from a booking. Full public form per spec (event
type, organisation, for-profit, ticketed, expected attendance, preferred + alternate dates,
setup/pack-down windows, multiple spaces of interest, description, AV needs, catering plan,
insurance status, how they found us). Coordinator inbox with accept / decline / request-more-info.
Vetting checklist (values alignment, restricted content, cleaning/damage risk, reputational risk,
deliverability) stored on the enquiry. Saved decline templates as text the coordinator copies.
Auto-triage rules: **defer to a later slice** — ship the checklist and templates first; a rules
engine is speculative until the church has run 20 real enquiries through the checklist.

**Files touched**
- New: `supabase/migrations/<ts>_create_venue_enquiries.sql` (table, RLS, and a replacement
  `submit_venue_enquiry` RPC alongside the existing `submit_venue_request`)
- New: `src/features/venues/api/venueEnquiriesApi.ts` + `Queries.ts` (+ tests)
- New: `src/features/venues/pages/VenueEnquiriesPage.tsx`, `VenueEnquiryDetailPage.tsx` + shims
- New: `src/features/venues/components/VenueEnquiryVettingCard.tsx`,
  `VenueEnquiryDeclineModal.tsx`
- Modify: `src/pages/PublicVenueRequest.tsx` (point at the new RPC, add the new fields),
  `src/App.tsx`, `AppSidebar.tsx`

**Migration notes:** the existing `submit_venue_request` RPC and `venue_bookings.source='public'`
rows stay working until an explicit cut-over — see **Q2**. Nothing is renamed or dropped in this
slice.

**Tests:** enquiry api; vetting state transitions as pure logic in
`src/features/venues/lib/venueEnquiries.ts` (test-first, the way `venueBookings.ts` was);
public-form validation and the safe-error whitelist for the new RPC.

**Effort: L.** **Depends on:** nothing. **Answers needed:** **Q2**, **Q3**.

---

## Slice 3 — Hires: the parent event (§7 spine, §16)

**Scope.** A `venue_hires` row that owns many `venue_bookings` (one per space per day-block),
one hirer, one event type, one quote, one status. Convert an accepted enquiry into a hire. Hire
detail page using the established section-rail + task-pane + right-sidebar detail layout already
used by Project Detail. Existing standalone bookings keep working — `hire_id` is nullable.

**Files touched**
- New: `supabase/migrations/<ts>_create_venue_hires.sql` (+ nullable `venue_bookings.hire_id`)
- New: `src/features/venues/api/venueHiresApi.ts` + `Queries.ts` (+ tests)
- New: `src/features/venues/pages/VenueHireDetailPage.tsx`, `VenueHiresPage.tsx` + shims
- New: `src/features/venues/components/VenueHireHeader.tsx`, `VenueHireSpacesPanel.tsx`
- Modify: `VenuesPage.tsx` (bookings that belong to a hire link to it), `VenueBookingList.tsx`,
  `VenueCalendar.tsx` (group chips by hire), `venueBookings.ts` types, `App.tsx`, `AppSidebar.tsx`

**This is the slice most likely to grow past its scope.** Hard boundary: it creates the parent and
the detail shell only. No run sheet, no staffing, no quoting inside it.

**Tests:** hire api; pure logic for "does this hire span these days / these spaces"; hire detail
page renders bookings grouped by day.

**Effort: L.** **Depends on:** 1, 2. **Answers needed:** **Q3** (reuse `events` tables or not) —
**this is the one genuinely blocking question in the plan.**

---

## Slice 4 — Quoting as line items (§5)

**Scope.** `venue_quote_lines` (description, kind, quantity, unit rate, total) replacing the fixed
money columns as the source of truth for a quote total. Line kinds: venue fee, resource add-on,
staff, deposit, bond, insurance surcharge, cleaning surcharge, damage waiver. Tiered venue rates
per event type. Print-styled quote sheet (copying `MeetingPrintSheet.tsx`) instead of a generated
PDF. Quote status: draft / sent / accepted / declined, set by staff.

**Not in scope:** emailing the quote or tracking "viewed" (needs slice 0/17).

**Files touched**
- New: `supabase/migrations/<ts>_create_venue_quote_lines.sql`
- New: `venueQuotesApi.ts` + `Queries.ts`, `src/features/venues/lib/venueQuoteTotals.ts` (pure,
  test-first), `VenueQuotePanel.tsx`, `VenueQuoteLineModal.tsx`, `VenueQuotePrintSheet.tsx`
- Modify: `VenueHireDetailPage.tsx`, `VenueBookingModal.tsx` (the existing fee/deposit/PA/coffee
  fields become quote lines — **a visible behaviour change requiring sign-off, see Q6**)

**Tests:** quote total arithmetic exhaustively (rounding, zero-quantity, internal hires);
line-item CRUD api; print sheet renders every line kind.

**Effort: M.** **Depends on:** 1, 3. **Answers needed:** **Q6**.

---

## Slice 5 — Run sheet (§7)

**Scope.** `venue_run_sheet_items`: per hire, per day, per space, per time slot — what's happening,
setup requirements (drawn from slice 1 resources), AV requirements, access rules, notes/risks.
Run-sheet templates per event type, and a "save this hire's run sheet as a template" action.
Printable and mobile-readable.

**Files touched:** new migration, `venueRunSheetApi.ts` + `Queries.ts`,
`lib/venueRunSheet.ts` (pure ordering/grouping logic, test-first),
`VenueRunSheetPanel.tsx`, `VenueRunSheetItemModal.tsx`, `VenueRunSheetPrintSheet.tsx`; modify
`VenueHireDetailPage.tsx`.

**Effort: L.** **Depends on:** 3. **Answers needed:** **Q3**, **Q8** (template scope).

---

## Slice 6 — Positions & assignment (§8, descoped)

**Scope, as narrowed by the user on 2026-08-14:** put a person into a needed position for an
event. Nothing else.

- Position roles per workspace (opener, technical, operations, car guard, cleaner, closer, plus
  whatever the church adds).
- Positions on a hire — a role, a time range, and how many are needed.
- Fill a position with a `people` row (via the existing `PeopleSearchSelect`) or, where the person
  isn't in the directory, a plain typed name.
- A board showing which positions are still unfilled, and reassignment to swap someone out.

**Out of scope, permanently: pay, rates, hours, paid-vs-unpaid, office hours, office-day swaps,
leave, freelancer priority, timesheets, payroll export, accept/decline workflows.** Handled in
house. This removes the old slice 7 entirely and the HR-data question with it.

**Files touched**
- New: `supabase/migrations/<ts>_create_venue_positions.sql`
- New: `src/features/venues/api/venuePositionsApi.ts` + `Queries.ts` (+ tests)
- New: `src/features/venues/lib/venuePositions.ts` (pure: unfilled-position detection, grouping by
  day — test-first, the way `venueBookings.ts` was) + test
- New: `src/features/venues/components/VenuePositionBoard.tsx`, `VenuePositionEditorModal.tsx`
- Modify: `VenueHireDetailPage.tsx` (one panel)

**New tables:** `venue_position_roles` (workspace-scoped role names), `venue_positions`
(hire_id, role_id, starts_at, ends_at, needed count, notes), `venue_position_assignments`
(position_id, person_id nullable, display_name for off-directory helpers).

**Tests:** unfilled-count logic exhaustively (over-filled, zero-needed, unassigned rows); api
insert/update branching + workspace scoping; board renders filled vs unfilled and assigns a
person.

**Effort: M** (down from L). **Depends on:** 3, 5. **Answers needed:** **Q7** (reuse Service
Planner's `service_team_*` tables or a small venues-local set — my recommendation is venues-local,
since those tables are shaped around a service instance, not a hire), **Q9** (whether per-person
constraints are wanted at all now that there's no pay logic riding on them).

---

## Slice 8 — Hirer portal (§6)

**Scope.** Token-addressed portal at `/hire/:token` — the same anonymous-RPC pattern as
`/venue-request/:token`, not a new auth role. Checklist the hirer works through: media upload,
final attendee count, arrival times, run of show, on-site POC + phone, food-truck list and power
needs, caterer, what they're bringing. Red-until-complete, visible to the coordinator on the hire
detail page. Reminders are surfaced to the *coordinator* to chase manually until slice 17.

**Files touched:** new migration (`venue_hire_checklist_items` + `venue_hires.portal_token` +
`security definer` RPCs, following `submit_venue_request`'s hardening exactly), a new public
storage bucket policy for hirer uploads, `src/pages/PublicHirePortal.tsx`,
`VenueHireChecklistPanel.tsx`; modify `App.tsx`.

**Security note:** a bearer URL that permits writes and file uploads. It needs the same
rate-limiting and error-sanitising treatment `submit_venue_request` already has, plus an upload
size/type cap and a revoke action. Worth a dedicated review pass.

**Effort: M.** **Depends on:** 3. **Answers needed:** **Q4** (token vs real accounts), **Q10**
(per-church branding).

---

## Slice 9 — Church-calendar clash detection (§4)

**Scope.** Extend `findConflicts` into a clash service that also reads `calendar_events`,
`service_instances`, and meetings, and shows a pre-quote clash view on the hire. Whether venue
bookings get mirrored into `calendar_events` (spec's "two-way sync") is **Q5** — this slice ships
read-side clash detection either way, which is the useful half.

Recurring programmes (worship practice, link groups) can only be detected if they exist as data
bound to a space (**C6**); if they don't, this slice detects clashes against whatever *is* in
`calendar_events` and the gap is stated plainly in the UI rather than faked.

**Effort: M.** **Depends on:** 3. **Answers needed:** **Q5**, **Q11**.

---

## Slices 10–16 — brief

| # | Slice | Scope | Effort | Depends |
|---|---|---|---|---|
| 10 | Contract, deposit & payments | Contract template with variable clauses, print + wet/upload signature (no e-sign dependency), payment records against the hire (amount, date, method) replacing the single `payment_status` enum | M | 4, **Q12** (PSP?) |
| 11 | Post-event | Debrief form, hirer rating, lesson notes that carry into the event-type template, one-click clone-for-a-future-date (pattern: `recurring_meetings`), financial summary from quote lines minus cleaning/damage cost (no staff cost — pay is in house) | M | 3, 6 |
| 12 | Reporting | Enquiry funnel, utilisation per space, revenue by event type/client, repeat hirers — using `recharts` + `src/components/ui/chart.tsx`, plus one dashboard widget registered in `widgetDefinitions.ts` | S | 3, 4 |
| 13 | Cleaning, damage & turnaround | Cleaning slots that respect in-use spaces, pre/post photo walkthroughs (reuse the `uploadVenueSpacePhoto` pattern), damage flagged against the deposit, turnaround checklist for the next service | M | 3, 5 |
| 14 | Safety & security | Car-guard requirement + hours, incident log attached to a hire, access-control plan, per-hire emergency contacts (link `service_contacts`) | S | 3 |
| 15 | Signage & AV presets | Signage library with "exists physically / needs reprint", printable signs, named AV routing presets per event type, changeover checklist with photos, AV asset check-out log | M | 5 |
| 16 | Mobile event-day view | Today's/next shift, run sheet for my zone, walkie channel, hirer POC, incident button, mark-task-done, photo upload — a focused mobile route, not a responsive afterthought | M | 5, 6 |

## Slice 17 — Automated comms

Only if slice 0 says yes. Delivers: decline replies to hirers, ministry-impact notices, 7/3/1-day
media chases, quote-sent tracking, post-event feedback requests. Each is a small addition once the
platform exists; without it they stay as drafts a human sends. **Effort: L** (mostly platform).

---

# Questions for you

## Blocking — I can't start slice 3 without these

**Q1 — `VENUE_SPACE_FEATURES`.** The fixed four-item list is a documented deliberate decision
("no free-form tags"), and `VenueBookingModal` filters requestable extras against it. The spec
wants a quantified, priced inventory. Do I (a) keep the constant for space *tags* and add the
inventory alongside it, (b) migrate the four strings into inventory rows and delete the constant,
or (c) leave the constant untouched and treat inventory as strictly additive? (Conflict C3)

**Q2 — enquiries vs bookings.** Do public requests become `venue_enquiries` rows that a
coordinator converts into a booking/hire (my recommendation — an unvetted enquiry currently
occupies the calendar and the conflict check), or do we grow `venue_bookings.status` to carry the
whole lifecycle? If the former: what happens to existing `source='public'` rows — migrate them
into enquiries, or leave them and cut over from a date? (Conflicts C1, C2)

**Q3 — the dormant `events` tables.** `events`, `event_checklist_items`, `event_team_roles`,
`event_logistics_items` exist in the database with checklists, roles and logistics, but their UI
was deleted and nothing reads them. Do I reuse them as the parent-hire model, build
venue-owned tables and leave those dormant, or drop them first? (Conflicts C10, C11)

## Needed before the slice that names them

**Q4 (slice 8) — hirer identity.** Anonymous bearer token at `/hire/:token`, matching the existing
`/venue-request/:token` pattern (my recommendation — no new auth surface), or real Supabase Auth
accounts for hirers with a new role and new RLS? (Conflict C9)

**Q5 (slice 9) — calendar direction.** The current design is deliberately one-way: Calendar reads
venue bookings, nothing is mirrored into `calendar_events`. The spec asks for two-way sync. Do we
invert that? (Conflict C5)

**Q6 (slice 4) — quote line items.** Moving to line items changes the booking modal's fee /
deposit / PA / coffee fields into quote lines, and changes the "internal bookings zero all money"
invariant. Confirm that behaviour change is wanted, and whether existing bookings' fees get
migrated into lines.

**Q7 (slice 6) — where venue positions live.** Reuse Service Planner's `service_team_roles` /
`service_team_assignments` (shaped around a service instance, not a hire, and read from pages with
no `api/` layer) or a small venues-local set of tables? I'd go venues-local. The pay half of this
question is closed — handled in house. (Conflict C13; the spec's Open Question 2)

**Q8 (slice 5) — templates.** Are run-sheet templates workspace-scoped and coordinator-editable,
or ACTSIX-shipped defaults per event type that a workspace can copy?

**Q9 (slice 6) — per-person constraints.** "Rens can't be here before 07:30" — do you still want
this now that no pay logic depends on it? If yes: on `people` (a cross-module change to a shared
table), on `workspace_members`, or venues-local? If it's just a note the coordinator reads, the
position's existing notes field covers it and no schema change is needed. My default is to skip it.

**Q10 (slice 8) — portal branding.** Per-church branded (workspace logo already exists via
`workspaces.logo_url` + the `workspace-logos` bucket) or a shared ACTSIX-branded surface? This is
the spec's Open Question 5.

**Q11 (slice 9) — recurring programmes.** Worship practice, link groups, youth and kids programmes
have no schema representation bound to a space. Do we model them (and where — Calendar, Service
Planner, or venues?), or does clash detection cover only what's already in `calendar_events` and
say so honestly?

**Q12 (slice 10) — payment rails.** No PSP, no invoicing, no money movement exists. Do deposits
stay staff-recorded ("Deposit paid", amount, date), or do we integrate a payment provider — and
which, for ZAR? This is the spec's Open Question 3.

## The spec's five Open Questions, answered where the audit already settles them

1. **"Is Actsix already storing spaces / resources anywhere?"** — Spaces: **yes**,
   `public.venue_spaces`, with photos, features, rates and colour. Resources: **no**, nothing.
2. **"How does rostering handle 'swap my office day'?"** — It doesn't. Service Planner rostering
   has roles, required counts and assignments, but no hours, rates, office days, leave or swaps.
   See **Q7**.
3. **"Payment rails already in Actsix?"** — **No.** Nothing. See **Q12**.
4. **"Multi-campus — scope venue hire per campus?"** — There is no campus concept anywhere in
   ACTSIX; tenancy is a flat workspace and `useCurrentWorkspace` resolves exactly one active
   membership. Adding campuses is a platform-wide change, not a venues one. Your call whether
   it's in scope at all. (Conflict C15)
5. **"Hirer portal branded per church or shared?"** — See **Q10**. Workspace logo and bucket
   already exist, so per-church branding is cheap.

## Two things I'd push back on

**The spec's "auto" verbs outnumber the platform.** §2, §4, §6, §9, §12 and §14 all assume
something sends email on a schedule. Neither exists. I've scheduled that as slice 0 (decide) and
17 (build), and every intermediate slice ships the useful half — the draft, the checklist, the
chase list — that a human sends. If automated comms is actually the point of the module, slice 0
should come first and slice 17 should move much earlier.

~~**Slice 7 (staff pay) is a payroll feature wearing a venue costume.**~~ Resolved — you've taken
pay, swaps and leave in house. Slice 6 is now assignment only and dropped from L to M, and slice 7
is gone. Note the knock-on: §14's financial summary and §15's staff-hours report lose their staff
cost figures, so both cover quoted revenue and non-staff costs only.

---

Waiting on your review, and at minimum on **Q1, Q2, Q3** before any code is written.
