# Venue Hire — Phase 2 Gap Analysis

Spec: `Actsix-Venue-Hire-Module-Spec.md` §2–§18, walked section by section against the code
described in [00-audit.md](00-audit.md). Conflicts are flagged, never resolved — every one of them
is a question for the user, collected in [02-build-plan.md](02-build-plan.md).

Legend: **exists** (built and usable) · **partial** (something is there, needs extending) ·
**missing** (nothing) · **conflict** (spec and code disagree about the model).

---

## §2 — Enquiry intake & vetting

**Partial (form) / missing (triage + vetting) / conflict (the entity model)**

| Spec item | Status | Evidence |
|---|---|---|
| Public enquiry form | partial | [src/pages/PublicVenueRequest.tsx](../../src/pages/PublicVenueRequest.tsx) collects space, title, from/until, name, email, phone, notes — 7 fields. The spec lists ~20: event type, organisation, for-profit flag, ticketed flag, expected attendance, alternate dates, setup/pack-down windows, multiple spaces of interest, AV needs, catering plan, insurance status, how they found us |
| Token-gated public link | exists | `workspaces.venue_request_token`, [VenueSpacesPage.tsx:45-63](../../src/features/venues/pages/VenueSpacesPage.tsx#L45-L63), RPC `get_venue_request_spaces` |
| Submission hardening | exists | `submit_venue_request` forces `status`/`source`/`booking_type`, accepts no money, rate-limits to 20/workspace/hour; client whitelists the five safe error strings |
| Auto-triage rules | missing | No rules engine, no rule storage, no auto-decline |
| Vetting checklist | missing | No values/restricted-content/risk/reputation/capability fields anywhere |
| Accept / decline / request-more-info with reply to hirer | missing | Status can be set to Confirmed/Cancelled in the modal, but nothing is sent to the hirer. **There is no outbound email in the codebase at all** |
| Saved decline templates | missing | No template storage |

**Conflict C1 — an enquiry is not a booking.** The spec treats enquiry → screening → quote →
contract as a lifecycle with its own states. The code writes a public request straight into
`venue_bookings` as `status='Pending'`, `source='public'`, and it immediately occupies the calendar
and the conflict check. An unvetted enquiry and a signed hire are the same row type. Adding the
spec's states (screening, quoted, declined, awaiting-info, contracted) either means growing that
`status` check constraint a long way, or introducing a separate `venue_enquiries` table. Not my
call.

**Conflict C2 — "spaces of interest" is plural in the spec, singular in the schema.**
`venue_bookings.space_id` is a single non-null FK. An enquirer wanting "auditorium + foyer +
kitchen" cannot be represented without either N rows or a join table.

---

## §3 — Venue & resource catalogue

**Partial**

| Spec item | Status | Evidence |
|---|---|---|
| Spaces with name/description/capacity/rates | exists | `venue_spaces` table; [VenueSpacesPage.tsx](../../src/features/venues/pages/VenueSpacesPage.tsx); [VenueSpaceEditorModal.tsx](../../src/features/venues/components/VenueSpaceEditorModal.tsx) |
| Photos | exists | `photo_urls text[]`, bucket `venue-space-photos`, [uploadVenueSpacePhoto.ts](../../src/features/venues/lib/uploadVenueSpacePhoto.ts) |
| Standing vs seated capacity | missing | One nullable `capacity` integer |
| Floor plan image | partial | `photo_urls` is an untyped array — a floor plan can be uploaded but is indistinguishable from a photo |
| "Can be hired standalone" flag | missing | Only `is_active` |
| Space dependencies ("auditorium locks out worship practice") | missing | No relation between spaces, and no relation from a space to a recurring church programme |
| Typical setup / pack-down time | missing | — |
| Food allowed flag | missing | — |
| Resource inventory (tables, chairs, stanchions, dividers, leads, walkie-talkies, signage stands) | missing | — |
| AV inventory (mic counts, desk, PC/iMac positions, lighting rig, cameras, feed destinations) | missing | — |
| Kitchen / cafe equipment | missing | — |
| Per-item: included vs paid add-on, quantity, allocated-elsewhere-today | missing | — |
| Restricted / staff-only zones | missing | — |

**Conflict C3 — features are a fixed four-item list, not an inventory.**
[venueBookings.ts:24-29](../../src/features/venues/lib/venueBookings.ts#L24-L29) hard-codes
`VENUE_SPACE_FEATURES = ["Projector", "Kitchen", "Air conditioning", "Tables & chairs"]` as a
`const` union, stored as `text[]` on both the space and the booking. The comment says this is
deliberate: *"Fixed checklist so space cards and filters stay consistent - no free-form tags."*
The spec wants a quantified, workspace-editable, individually-priced inventory with double-booking
detection. These are different designs, and the existing one is a stated decision, not an
oversight. `VenueBookingModal` also filters requestable extras to the intersection of the space's
features and this constant ([VenueBookingModal.tsx:153-160](../../src/features/venues/components/VenueBookingModal.tsx#L153-L160)),
so replacing the constant changes booking behaviour, not just the catalogue.

**Conflict C4 — "Kitchen" is currently a space *feature*, but the spec models the kitchen as both
a bookable space and a restricted zone.** Whichever way this goes, existing rows carry the string.

---

## §4 — Availability & church-calendar clash detection

**Partial (venue-vs-venue only) / missing (everything else)**

| Spec item | Status | Evidence |
|---|---|---|
| Venue-vs-venue overlap warning | exists | Pure `findConflicts()` ([venueBookings.ts:73-90](../../src/features/venues/lib/venueBookings.ts#L73-L90)), half-open intervals, ignores Cancelled and self; surfaced as a non-blocking alert with a "Book anyway" tick that resets when the clash set changes ([VenueBookingModal.tsx:168-181](../../src/features/venues/components/VenueBookingModal.tsx#L168-L181), 410-434) |
| Month calendar of bookings | exists | [VenueCalendar.tsx](../../src/features/venues/components/VenueCalendar.tsx) |
| Clash against `calendar_events` | missing | — |
| Clash against services (`service_instances`) | missing | — |
| Clash against meetings, link groups, youth/kids programmes | missing | Nothing in the schema models a recurring on-site programme with a room |
| Clash against staff office hours / cleaning windows | missing | Office hours do not exist as data |
| Pre-quote "clash view" | missing | — |
| Auto-notify affected ministry leaders with an alternative | missing | No notification is fired from venues today, and no email exists |

**Conflict C5 — the calendar integration runs the wrong direction for this.** Today
[CalendarModule.tsx:225](../../src/pages/CalendarModule.tsx#L225) reads venue bookings into the
calendar view; venues never reads the calendar. The design note in the original plan is explicit:
*"the existing Calendar module reads venue bookings as one more source — nothing is mirrored into
`calendar_events`."* §4 requires the reverse dependency, and §16 asks for "two-way sync". That
inverts a deliberate decision.

**Conflict C6 — link groups / worship practice / youth programmes have no home in the schema.**
There is no table for a recurring on-site programme bound to a space. `calendar_events` has a free
text `location`, not a `space_id`. So "this hire forces worship practice to move" cannot be
computed from anything that exists — the programme data has to be created first, and where it
lives (Calendar? Service Planner? a new venues-owned table?) is an architectural decision.

---

## §5 — Quoting

**Partial**

| Spec item | Status | Evidence |
|---|---|---|
| Venue fee per space | exists | `hourly_rate`, `daily_rate` on `venue_spaces`; daily rate pre-fills a new external booking ([VenueBookingModal.tsx:162-166](../../src/features/venues/components/VenueBookingModal.tsx#L162-L166)) |
| A single quoted fee + deposit | exists | `quoted_fee`, `deposit_amount` |
| Two hard-coded add-ons | partial | `needs_technician`/`technician_fee` (labelled "PA System" in the UI) and `coffee_requested`/`coffee_fee` |
| Requested extras from space features | partial | `requested_features text[]`, no price per item |
| Tiered rates by event type / for-profit / brand impact | missing | — |
| Staff lines with role, hours, rate (spec default R175/hour) | missing | A charge *to the hirer* for staffing, not a payment to staff — in scope as a quote line. What staff actually get paid is out of scope (handled in house) |
| Arbitrary add-on line items | missing | Add-ons are two boolean columns, not rows |
| Security bond | missing | Deposit exists; bond does not |
| Insurance surcharge | missing | — |
| Cleaning surcharge | missing | — |
| Damage waiver / protection cost | missing | — |
| Branded PDF quote | missing | **No PDF generation anywhere in the codebase.** Printing is print-styled React + browser dialog (`MeetingPrintSheet.tsx`) |
| Send quote, track sent/viewed/accepted/declined | missing | No outbound email, no view tracking |
| Roll an accepted quote into a contract | missing | — |

**Conflict C7 — quote lines are columns, not rows.** The spec's quote is a line-item document.
The code has fixed money columns on the booking, and
[venuesApi.ts:113-130](../../src/features/venues/api/venuesApi.ts#L113-L130) deliberately zeroes
every one of them when `booking_type = 'internal'` (documented: *"an internal one is stored with
zeroed fees so a booking that switches type never leaves a stale price behind"*). A line-item
table changes that invariant and the internal/external switch that enforces it.

**Conflict C8 — `technician_fee` vs the UI's "PA System".** The column name and the user-visible
label already disagree. §5's "staff lines with role and rate" and §8's technical role make this
worse: is `needs_technician` an add-on price, or the first staff line? Renaming the column needs a
migration and a call-out.

---

## §6 — Contract, deposit, and pre-event checklist

**Missing**, with one adjacent piece.

| Spec item | Status | Evidence |
|---|---|---|
| Payment status against the booking | partial | `payment_status` enum (`Not applicable`/`Unpaid`/`Deposit paid`/`Paid`), set by hand in the modal. No amounts received, no dates, no ledger |
| Templated contract with variable clauses | missing | — |
| E-signature | missing | No signing anything, no new dependency permitted without asking |
| Deposit invoice on signature, balance on a schedule | missing | **No invoicing and no scheduler.** Nothing in the codebase runs on a timer |
| Hirer pre-event portal (login) | missing | Auth is Supabase Auth for workspace members. An external hirer has no account, no role, and no RLS path to their own booking. The only anonymous surface is the token RPC pair |
| Media upload by hirer, with 7/3/1-day reminders | missing | Reminders (`public.reminders`) are user-authored rows read by the UI, not dispatched. Nothing sends |
| Final attendee count, dietary, arrival times, run of show, on-site POC, food-truck/power, caterer, what they're bringing | missing | — |
| Red-until-complete checklist visible to the coordinator | missing | — |

**Conflict C9 — the hirer portal needs an identity model that does not exist.** Either external
hirers become Supabase Auth users with a new role and new RLS (a significant auth change), or the
portal is another unauthenticated token surface like `/venue-request/:token` (simpler, matches the
existing pattern, but it's a bearer URL granting write access to a booking's documents). `.ai/CLAUDE.md`
requires asking before "introducing a new architectural pattern" and never bypassing RLS.

---

## §7 — Event build plan (the run sheet)

**Missing**

| Spec item | Status | Evidence |
|---|---|---|
| Per-day, per-space, per-slot schedule | missing | A booking is one space × one contiguous range. Nothing subdivides it |
| Setup requirements per slot | missing | — |
| AV requirements per slot | missing | — |
| Access rules (doors open/locked, restricted zones) | missing | — |
| Staff assigned per slot | missing | — |
| Notes / risks per slot | missing | Only the booking-level `notes text` |
| Template per event type | missing | No event-type concept in venues (`booking_type` is only internal/external) |
| Lessons carried into next year's template | missing | — |
| Printable, mobile-friendly, shareable | partial pattern | [MeetingPrintSheet.tsx](../../src/features/meetings/components/MeetingPrintSheet.tsx) is a working print-styled React precedent to copy. Nothing venue-side |

**Conflict C10 — the run sheet needs a parent "event" that spans days and spaces; `venue_bookings`
has no parent.** A Wed-setup / Thu-dinner / Fri–Sat-competition hire across auditorium, foyer and
kitchen is 6+ unrelated rows today, with no way to say they are one hire, one hirer, one quote.
This is the single biggest structural gap and almost everything in §7–§14 depends on how it is
resolved.

**Conflict C11 — the dormant `events` tables already model part of this.** `public.events`,
`event_checklist_items`, `event_team_roles`, `event_logistics_items` exist (migrations
`20260612100000`, `20260612120000`) with checklists, team roles and logistics assignment — but
their UI was deleted and nothing in `src/` reads them. Building a parallel `venue_events` +
`venue_run_sheet_items` + `venue_shifts` set would duplicate concepts that are already in the
database. Reusing them means adopting tables whose UI was deliberately removed. Both directions
are defensible; neither should be chosen silently.

---

## §8 — Staffing & shift allocation

**Descoped by the user (2026-08-14): pay, swaps and leave are handled in house.** The requirement
is only *"place a User/Name into a needed position/staffing for an event."* Everything in this
section about compensation is therefore out of scope, and the conflicts it raised (C12, C13) are
closed rather than open.

**Missing** in venues. An adjacent, weaker model exists.

| Spec item | Status | Evidence |
|---|---|---|
| Roles per shift block (opener, technical, ops, car guard, cleaner, closer) | missing | — |
| A named position filled by a person | missing | Nearest analogue: `service_team_roles` + `service_team_role_requirements` + `service_team_assignments` (Service Planner) — roles, required counts, per-person assignment with a status. Read from pages directly, no `api/` layer. Reusable pickers exist (`PeopleSearchSelect`) |
| Board showing which positions are still unfilled | missing | — |
| Paid vs unpaid by office hours | **out of scope** | Handled in house |
| Office-day swap, annual leave + hire pay | **out of scope** | Handled in house |
| Freelancer priority / "reserve for freelancer" | **out of scope** | Handled in house |
| Rates, hours, timesheets, payroll export | **out of scope** | Handled in house |
| Accept / decline / propose swap | **out of scope** | Handled in house |
| In-event shift handover | missing | Reduced to: reassign the position to someone else |
| Per-person constraints ("can't be here before 07:30") | missing | Not on `people`, not on `workspace_members`. Optional — see Q9 |

**C12 (payroll data) — closed.** Not building it.

**C13 (extend rostering vs build parallel) — narrowed, still open as Q7.** Without pay, the
question is only whether venue positions reuse Service Planner's `service_team_*` tables (which
are service-instance-shaped, not hire-shaped) or get a small venues-local table. The objection
that extending rostering would drag a pay model into worship rostering no longer applies.

---

## §9 — Impact & communication to internal ministries

**Missing**

Auto-drafted notices to worship lead, link-group leaders, cleaner, cafe manager: nothing exists,
and both prerequisites are missing — the affected-programme data (C6) and any send mechanism.

What *does* exist to build on: in-app notifications (`public.notifications` + RPCs
`actsix_create_notification_for_user` / `_for_person`, wrapped in
[src/lib/notifications.ts](../../src/lib/notifications.ts), surfaced by `NotificationBell.tsx`).
That covers workspace members only.

**Conflict C14 — "auto-drafts notices" implies email; the codebase has none.** The only outbound
channel is `supabase/functions/whatsapp-agent` (Twilio WhatsApp, secret-gated). In-app
notifications reach staff but not a cleaner without an account, and not the hirer at all. Adding
transactional email is a new dependency + a new secret + a new edge function.

---

## §10 — Signage, comms, and rules enforcement

**Missing**

- Signage library / which signs physically exist / reprint tracking: nothing.
- Walkie-talkie channel plan: nothing (depends on the run sheet, §7).
- Hirer point-of-contact surfaced to staff: partial — `hirer_name`/`hirer_phone`/`hirer_email` exist
  on the booking and render in [VenueBookingList.tsx](../../src/features/venues/components/VenueBookingList.tsx),
  but that's the billing contact, not a separate on-site POC, and it appears only on the booking
  card.

---

## §11 — Live-feed / AV infrastructure

**Missing** entirely. No AV assets, no routing presets, no changeover checklist, no asset
check-out or condition log. Note the spec's own framing ("should be a log entry not a hallway
conversation") implies an asset register that does not exist even at the space level — AV is a
single string in `VENUE_SPACE_FEATURES` ("Projector").

---

## §12 — Cleaning, damage, and turnaround

**Missing**

| Spec item | Status |
|---|---|
| Cleaning schedule respecting in-use spaces | missing |
| Pre/post-event photo walkthrough | missing — though the storage + upload pattern exists (`uploadVenueSpacePhoto.ts`, workspace-scoped bucket paths) and is directly reusable |
| Damage flagged against the deposit | missing — `deposit_amount` is a number with no claim, deduction, or refund concept |
| Turnaround checklist for the next service | missing |
| Auto-recompute the turnaround window on a late teardown | missing — no scheduler, and no setup/pack-down windows on a booking |

---

## §13 — Safety & security

**Missing.** No car-guard flag, no incident log, no access-control plan, no per-event emergency
contacts. `service_contacts` is a workspace-wide outside-contact book (police, ambulance,
electrician) with a usage log — the closest existing thing, but it is not event-scoped.

---

## §14 — Post-event

**Missing**

- Debrief form, hirer behaviour rating, damage found: nothing.
- Hirer feedback request: nothing (no email).
- Repeat-hire / clone-for-a-future-date: nothing. Note `recurring_task_templates` and
  `recurring_meetings` are established precedents for "template → instance" in this codebase.
- Financial summary (revenue, cleaning, damage, net): nothing. **Staff cost is out of scope** —
  pay is handled in house, so the summary covers quoted revenue and cost lines only.
- Testimonials & photos for marketing: nothing.

---

## §15 — Reporting & dashboards

**Missing.** No venue reporting of any kind. Enabling infrastructure exists and is worth noting:
`recharts` is installed, `src/components/ui/chart.tsx` is present, and the dashboard widget system
([src/features/dashboard/](../../src/features/dashboard/)) has a registry
(`data/widgetDefinitions.ts`) plus 10 widgets — adding a venue widget is a well-trodden path.
`activity_logs` + [src/lib/activityLog.ts](../../src/lib/activityLog.ts) exist but venues writes
nothing to them.

---

## §16 — Integrations (Actsix core)

| Integration | Status | Detail |
|---|---|---|
| People / membership | missing | `venue_bookings` links to `service_contacts`, never to `people`. "Bill a staff funeral differently" has no hook. Reusable pickers exist: `PeopleSearchSelect`, `PeopleMultiSearchSelect` |
| Calendar | partial, one-way | Calendar reads venue bookings ([CalendarModule.tsx:207-297](../../src/pages/CalendarModule.tsx#L207-L297)); venues does not read Calendar. Spec asks for two-way — see **C5** |
| Rostering | missing | No link to Service Planner — see **C13**. Scope is assignment only |
| Finance / payroll | missing | Module does not exist. **Payroll is out of scope** (handled in house); quote/invoice money stays in venues |
| Communications | partial | In-app notifications exist and venues fires none. No email. WhatsApp exists as one Twilio edge function |
| Documents / assets | partial | Per-feature Storage buckets; venues has `venue-space-photos` only. No contracts, insurance certs, or floor-plan typing. No document entity |

**Conflict C15 — Open Question 4 (multi-campus).** There is no campus/site concept anywhere in
ACTSIX. Tenancy is one flat `workspace`, and `useCurrentWorkspace` resolves exactly one active
membership. Scoping venue hire per campus means a schema-wide concept, not a venues-local one.

---

## §17 — Mobile experience

**Partial (chrome) / missing (the content)**

The app is mobile-aware: `MobileBottomNav.tsx`, `useMediaQuery`/`use-mobile`, `responsive-modal.tsx`,
`drawer.tsx` (vaul), PWA manifest + service worker, and venue pages/cards use responsive Tailwind
grids. So a phone can reach `/venues` today.

Missing: everything §17 lists as content — today's shift, run sheet for a zone, walkie channel,
incident button, task-done ticks, photo upload against damage. All depend on §7/§8/§13.

---

## §18 — Nice-to-haves (v2)

All **missing**, correctly out of scope for now: public live-availability widget (note: the
`get_venue_request_spaces` RPC is a working precedent for exposing read-only data to `anon`),
foyer-TV wayfinding, participant waivers, food-truck vendor marketplace, recurring hires.

---

## Cross-cutting notes

1. **`src/integrations/supabase/types.ts` does not include any venue table.** New tables won't
   either, so new data-access code follows the existing `(supabase as any)` pattern unless the
   types file is regenerated (a decision in its own right).
2. **No scheduler + no email = every "auto-send", "auto-remind", "auto-notify" line in the spec
   (§2, §4, §6, §9, §12, §14) is blocked on infrastructure that does not exist.** These aren't
   feature gaps, they're platform gaps, and they'll dominate effort if scheduled early.
3. **No CI.** Verification is the local `tsc` / `lint` / `test` / `build` sequence in `.ai/CLAUDE.md`.
4. **`.ai/CLAUDE.md` requires confirmation before touching more than 2–3 files or introducing a new
   architectural pattern.** Several slices below exceed that by design, so each one gets explicit
   sign-off before it starts.

## Conflict index

| # | Conflict | Section |
|---|---|---|
| C1 | Enquiry and booking are the same row; spec wants a lifecycle | §2 |
| C2 | One booking = one space; spec allows multiple spaces of interest | §2 |
| C3 | `VENUE_SPACE_FEATURES` is a deliberate fixed list vs spec's quantified inventory | §3 |
| C4 | Kitchen modelled as a feature vs as a space and restricted zone | §3 |
| C5 | Calendar↔venues is deliberately one-way; spec wants two-way | §4, §16 |
| C6 | Link groups / worship practice have no schema representation | §4 |
| C7 | Quote money is columns with an internal-zeroing invariant vs spec's line items | §5 |
| C8 | `needs_technician`/`technician_fee` column names vs "PA System" UI vs staff lines | §5, §8 |
| C9 | Hirer portal has no identity model (new auth role vs another bearer token) | §6 |
| C10 | No parent event spanning days and spaces | §7 |
| C11 | Dormant `events`/`event_*` tables already model checklists, roles, logistics | §7 |
| ~~C12~~ | ~~Staff pay rules need HR data ACTSIX doesn't store~~ — **closed**, pay handled in house | §8 |
| C13 | Extend Service Planner rostering vs build parallel — narrowed to assignment only | §8 |
| C14 | "Auto-draft notices" implies email; no email channel exists | §9 |
| C15 | No campus concept for multi-campus scoping | §16 |
