# Venue Hire / Management

Date: 2026-08-09
Status: Approved

## Problem

A church building is one of its larger assets, and nothing in ACTSIX models it.
Two distinct needs collide in the same physical space:

- **Internal** — a ministry needs the hall on Thursday night, and needs to know
  nobody else has it. Today this lives in someone's head, a wall calendar, or a
  group chat, and double-bookings get discovered on the day.
- **External hire** — an outside party (a playgroup, a community group, a
  wedding) hires a space for a fee. Someone has to track who booked what, what
  they were quoted, and whether they've paid.

Neither is served by the existing modules. `calendar_events` records that
something is happening, but knows nothing about *which space* it occupies, so
it cannot detect a clash. `events` models a church-run event's checklists and
logistics, not a third party renting a room. `service_contacts` already holds
external contacts (name, phone, email, address) but has no link to a booking.

## Goal

One booking system covering both cases. A space has availability; a booking
against it is either internal (no fee) or external (quoted fee, deposit,
payment status). The same conflict detection runs for both.

**Explicitly out of scope for v1:**

- Recurring booking series. A weekly hire is entered per occurrence. Revisit
  once someone has actually re-entered the same hire four weeks running.
- Invoice or receipt documents. v1 records the numbers; it does not generate a
  printable invoice. (The printable-minutes letterhead pattern from Meetings is
  the obvious basis if this is added later.)
- A payment ledger — line items, tax, part-payment history.
- Equipment inventory, maintenance schedules, cleaning rosters.
- Online payment collection.

## Data model

Two new tables, plus one column on `workspaces`. Follows the conventions in
`20260612130000_create_calendar_module.sql`: `workspace_id` + `user_id` on
every row, `text not null default ''` over nullable text, `check` constraints
for enumerated values, RLS scoped to active workspace members.

### `venue_spaces`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | `gen_random_uuid()` |
| `workspace_id` | uuid not null | → `workspaces(id)` on delete cascade |
| `user_id` | uuid not null | creator |
| `name` | text not null | e.g. "Main Hall" |
| `description` | text not null default `''` | |
| `capacity` | integer null | seated capacity, optional |
| `hourly_rate` | numeric(10,2) not null default 0 | external hire rate |
| `daily_rate` | numeric(10,2) not null default 0 | external hire rate |
| `color` | text not null default `''` | calendar swatch |
| `is_active` | boolean not null default true | retire a space without deleting history |
| `created_at` / `updated_at` | timestamptz not null default `now()` | |

Rates are defaults that pre-fill a new booking's quoted fee. They are not
enforced — a booking's fee is always whatever is stored on the booking, so
changing a rate never rewrites history.

### `venue_bookings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `workspace_id` | uuid not null | → `workspaces(id)` on delete cascade |
| `user_id` | uuid not null | creator; the anon RPC writes `workspaces.owner_user_id` |
| `space_id` | uuid not null | → `venue_spaces(id)` on delete restrict |
| `title` | text not null | "Robertson wedding", "Youth night" |
| `booking_type` | text not null default `'internal'` | check in (`internal`, `external`) |
| `hirer_contact_id` | uuid null | → `service_contacts(id)` on delete set null |
| `hirer_name` | text not null default `''` | raw details from a public request, |
| `hirer_email` | text not null default `''` | before a contact record is created |
| `hirer_phone` | text not null default `''` | |
| `starts_at` | timestamptz not null | |
| `ends_at` | timestamptz not null | check `ends_at > starts_at` |
| `status` | text not null default `'Pending'` | check in (`Pending`, `Confirmed`, `Cancelled`) |
| `quoted_fee` | numeric(10,2) not null default 0 | |
| `deposit_amount` | numeric(10,2) not null default 0 | |
| `payment_status` | text not null default `'Not applicable'` | check in (`Not applicable`, `Unpaid`, `Deposit paid`, `Paid`) |
| `source` | text not null default `'staff'` | check in (`staff`, `public`) |
| `notes` | text not null default `''` | |
| `created_at` / `updated_at` | timestamptz not null default `now()` | |

An internal booking is `booking_type = 'internal'`, fee and deposit 0, payment
status `'Not applicable'`. The UI hides the money fields entirely for internal
bookings rather than showing zeroed inputs.

Both hirer representations exist because a public request arrives before anyone
has vetted it. Staff promote a request to a `service_contacts` row (category
"Hirer") when they approve it; `hirer_contact_id` then takes precedence over the
raw fields for display.

Indexes:

```sql
venue_bookings(workspace_id, starts_at)
venue_bookings(space_id, starts_at)          -- conflict lookups
venue_bookings(workspace_id, status)         -- pending queue badge
venue_spaces(workspace_id, name)
```

### `workspaces.venue_request_token`

One `text` column, nullable, unique, added by `alter table` (the `workspaces`
table predates this repo's migration history). Generated on demand when a
workspace first enables the public request form; cleared to revoke the link. A
single workspace-level token is enough because the form lists every active
space — there is no per-space link to manage.

The existing `workspaces.join_code` is deliberately not reused: it grants entry
to the workspace, and a hire-request link is handed to strangers. Revoking one
must never revoke or expose the other.

## Public request intake

Anonymous users get no table policy on `venue_bookings`. Instead a
`security definer` RPC is the only anon-reachable write path:

```sql
submit_venue_request(
  token text,
  space_id uuid,
  title text,
  hirer_name text,
  hirer_email text,
  hirer_phone text,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text
) returns void
```

The function resolves `token` to a workspace, raises if it does not match,
verifies `space_id` belongs to that workspace and is active, and then inserts
with `status` forced to `'Pending'`, `source` forced to `'public'`,
`booking_type` forced to `'external'`, and all money fields left at their
defaults. A submitter can never set their own status, fee, or workspace.

A matching read RPC, `get_venue_request_spaces(token)`, returns the active
spaces (name, description, capacity only — no rates) so the public form can
render its picker without exposing the `venue_spaces` table to anon.

Validation runs on both sides: the form checks required fields and that the end
time is after the start; the RPC re-checks the same before inserting.

## Conflict detection

One pure function, in `src/features/venues/lib/venueBookings.ts`:

```ts
findConflicts(
  candidate: { id?: string; spaceId: string; startsAt: string; endsAt: string },
  existing: VenueBooking[],
): VenueBooking[]
```

Returns every existing booking on the same space whose interval overlaps the
candidate's. Rules:

- Cancelled bookings never conflict.
- The candidate's own row is excluded when editing (`id` match).
- Intervals are half-open: a booking ending at 12:00 does not conflict with one
  starting at 12:00. Back-to-back hires are the common case, not an error.
- Both Pending and Confirmed bookings conflict, but the returned booking's
  status is surfaced so the UI can distinguish "clashes with a confirmed
  booking" from "clashes with a request nobody has approved yet".

Overlaps are warned about, never blocked. The booking modal shows a banner
naming the clashing booking(s) and their status, with a "Book anyway" confirm.
There is no database exclusion constraint — setup crews, shared spaces, and
staggered access all make legitimate overlaps routine, and a hard block would
push staff back out to the wall calendar.

This function is the module's one required unit test:
`venueBookings.test.ts` covers exact overlap, partial overlap at each end,
containment, back-to-back boundary (no conflict), cancelled (no conflict),
different space (no conflict), and self-exclusion on edit.

## Surfaces

| Route | Page | Purpose |
| --- | --- | --- |
| `/venues` | `VenuesPage` | Booking calendar + list. Status filter chips with a Pending count badge. Create/edit through a modal. |
| `/venues/spaces` | `VenueSpacesPage` | Manage spaces and their rates; generate or revoke the public request link. |
| `/venue-request/:token` | `PublicVenueRequest` | Unauthenticated request form. |

There is no booking detail page — a booking is small enough to edit in a modal,
matching `ProjectEditorModal`. Pending requests are a filter on `/venues`, not
a separate route; approving one is a status change plus an optional "save hirer
as contact" step in the same modal.

The public route sits at `src/pages/PublicVenueRequest.tsx` alongside the
existing `PublicEventRegistration.tsx`, and is registered outside the
authenticated route group in `App.tsx`.

### Calendar integration

`CalendarModule.tsx` already merges several sources — `calendar_events`,
`calendar_sync_connections`, and `tasks`. Venue bookings become a fourth read
source there, filtered to non-cancelled rows and rendered with the space's
color. Nothing is written to `calendar_events`, so there is no mirror to keep
in sync and no possibility of the two records diverging.

## Files

```
supabase/migrations/<timestamp>_create_venue_hire.sql
src/features/venues/api/venuesApi.ts
src/features/venues/lib/venueBookings.ts
src/features/venues/lib/venueBookings.test.ts
src/features/venues/components/VenueBookingModal.tsx
src/features/venues/components/VenueBookingList.tsx
src/features/venues/components/VenueCalendar.tsx
src/features/venues/components/VenueSpaceEditorModal.tsx
src/features/venues/pages/VenuesPage.tsx
src/features/venues/pages/VenueSpacesPage.tsx
src/pages/PublicVenueRequest.tsx
```

Modified: `src/App.tsx` (three routes), the sidebar navigation component, and
`src/pages/CalendarModule.tsx` (one extra query and its merge).

`venuesApi.ts` holds every Supabase call — list spaces, upsert space, list
bookings for a range, upsert booking, update status, delete. Pages and
components never call Supabase directly, matching `projectsApi.ts`.

## Error and empty states

- **No spaces yet** — `/venues` shows an empty state pointing at
  `/venues/spaces`; the booking modal cannot be opened without a space.
- **No bookings in range** — calendar renders empty with a "Nothing booked"
  note; the list shows a create prompt.
- **Invalid or revoked public token** — the public page renders a plain "This
  request link is no longer active" message. No workspace name, no space list,
  no hint about whether the token ever existed.
- **Public submission fails** — inline error on the form with the submitted
  values preserved, and a retry.
- **Space in use on delete** — `on delete restrict` means deleting a space with
  bookings fails; the UI offers deactivation (`is_active = false`) instead,
  which hides it from new bookings while preserving history.

## Testing

- `venueBookings.test.ts` — the conflict cases listed above. Required.
- `venuesApi.test.ts` — payload shaping for booking create/update, following
  `projectsApi.test.ts`. Worth having because the internal/external branch
  decides which money fields are written.
- Manual browser pass: create a space, book it internally, book it externally
  with a fee, trigger an overlap warning and override it, submit through the
  public link, approve the request and save the hirer as a contact, confirm the
  booking appears on `/calendar`.

## Notes

The freeze on new modules recorded in project memory (Tasks polished before
breadth) was explicitly overridden for this module on 2026-08-09.
