# Venue Hire — Phase 1 Audit

Read-only audit of the ACTSIX codebase as it stands on branch `fix/inbox-project-status-default`
(HEAD `1713a252`). No code was changed. This is the input to the Phase 2 gap analysis; it
deliberately does not compare against the spec.

---

## 1. Architecture context

| Concern | What's actually used |
|---|---|
| Language | TypeScript (strict-ish; `tsconfig.app.json` is the typecheck target) |
| Front end | React 18, Vite 5 (`@vitejs/plugin-react-swc`), React Router 6 (`BrowserRouter`, routes centralised in `src/App.tsx`) |
| UI kit | Tailwind CSS + shadcn/ui (Radix primitives vendored into `src/components/ui/`), `lucide-react` icons, `sonner` for toasts, `class-variance-authority` + `tailwind-merge` (`cn()` in `src/lib/utils.ts`) |
| Design system | "Studio" — `--st-*` tokens on `:root` in `src/index.css`, documented in `DESIGN.md`. App-wide as of `aedddacb`/`42184bf2`. Page chrome uses shared classes: `actsix-page-body`, `actsix-page-stack`, `actsix-btn-primary`, `label-eyebrow` |
| Server / DB | Supabase (Postgres + RLS + Storage + Edge Functions). No custom backend, no ORM — PostgREST query builder called directly from the client |
| Server-side logic | Postgres `security definer` functions (RPCs) and Deno edge functions in `supabase/functions/` (`meeting-ai`, `whatsapp-agent`, `event-registration-hosted-form`, `apple-calendar-sync`) |
| Data fetching | TanStack Query v5 (`QueryClient` created in `src/App.tsx`). Migration to it is **partial** — newer code uses `useQuery` hooks in `api/*Queries.ts`; older pages still do `useEffect` + `useState` + direct `api` calls |
| Auth | Supabase Auth. `src/hooks/useAuth.tsx` provides the session/user; `src/hooks/useCurrentWorkspace.ts` resolves the single active `workspace_members` row and derives roles (`isAdmin`, `isEditor`, `canManageWorkspace`, `canEditPeopleDirectory`, …). Roles: `admin \| editor \| group_leader \| viewer \| member` |
| Tenancy | Every domain table carries `workspace_id` + `user_id`. RLS policies check an *active* `workspace_members` row for `auth.uid()`. There is no campus/site concept below workspace |
| Background jobs | **None.** No queue, no cron, no scheduler. Anything "automatic" today is either a Postgres trigger (notifications), an edge function called on demand, or client-side code. Reminders (`public.reminders`) are rows read by the UI, not dispatched jobs |
| Tests | Vitest + jsdom + Testing Library (`vitest.config.ts`, `src/test/setup.ts`). `npm test` = `vitest run`. Shared Supabase chain mock in `src/test/supabaseMock.ts` |
| Lint/build | `eslint.config.js` (flat config), `npm run build` (Vite), `npx tsc -p tsconfig.app.json --noEmit` |
| Deploy target | Static SPA build (`dist/`) on a Cloudflare-Pages-style host — `public/_redirects` (`/* /index.html 200`) and `public/_headers` (cache policy). PWA: `public/manifest.webmanifest` + `public/service-worker.js` + `src/registerServiceWorker.ts`. **No CI** — `.github/` exists but contains no workflows |
| Generated DB types | `src/integrations/supabase/types.ts` is **stale**. It has no `venue_spaces`, `venue_bookings`, `calendar_events`, `events`, `service_contacts`, `reminders`, `training_lessons`. Hence the codebase-wide `(supabase as any)` cast, explicitly blessed in `.ai/CLAUDE.md` |

### Module gating

Three layers decide whether a module is visible:

- [src/lib/releaseMode.ts](src/lib/releaseMode.ts) — `ActsixModuleKey` union + `alpha`/`beta`/`full` maps. `venues: true` in alpha and full.
- [src/lib/modules.ts](src/lib/modules.ts) — per-workspace toggles. `venues` is in `OPTIONAL_MODULES`, **default off** (`DEFAULT_ACTIVE_MODULES.venues = false`), label "Venue Hire", and `getModuleKeyForPath` maps `/venues*` to it.
- [src/components/AppSidebar.tsx:159-169](src/components/AppSidebar.tsx#L159-L169) — nav section `venues` in the "Planning" group with two children: Bookings (`/venues`), Spaces (`/venues/spaces`).

---

## 2. Existing Venue Hire code

### Migrations (3)

| File | What it does |
|---|---|
| [supabase/migrations/20260809120000_create_venue_hire.sql](supabase/migrations/20260809120000_create_venue_hire.sql) | Creates `venue_spaces`, `venue_bookings`, adds `workspaces.venue_request_token` + unique partial index, 4 indexes, RLS ("Workspace members manage venue records", `for all`, active-member check), and two `security definer` RPCs: `get_venue_request_spaces(text)` and `submit_venue_request(...)` granted to `anon` |
| [supabase/migrations/20260810120000_add_venue_space_features.sql](supabase/migrations/20260810120000_add_venue_space_features.sql) | Adds `venue_spaces.features text[]` |
| [supabase/migrations/20260810121000_add_venue_space_photos_and_booking_addons.sql](supabase/migrations/20260810121000_add_venue_space_photos_and_booking_addons.sql) | Adds `venue_spaces.photo_urls text[]`; adds `venue_bookings.requested_features text[]`, `needs_technician`, `technician_fee`, `coffee_requested`, `coffee_fee`; creates the public `venue-space-photos` storage bucket + 4 storage policies |

### Tables (2) + 1 column

**`public.venue_spaces`** — `id`, `workspace_id`, `user_id`, `name`, `description`, `capacity` (nullable int), `hourly_rate`, `daily_rate` (`numeric(10,2)`), `color`, `features text[]`, `photo_urls text[]`, `is_active`, `created_at`, `updated_at`.

**`public.venue_bookings`** — `id`, `workspace_id`, `user_id`, `space_id` (FK → `venue_spaces`, `on delete restrict`), `title`, `booking_type` (`internal|external`), `hirer_contact_id` (FK → `service_contacts`, nullable), `hirer_name/email/phone`, `starts_at`, `ends_at`, `status` (`Pending|Confirmed|Cancelled`), `quoted_fee`, `deposit_amount`, `payment_status` (`Not applicable|Unpaid|Deposit paid|Paid`), `source` (`staff|public`), `requested_features text[]`, `needs_technician`, `technician_fee`, `coffee_requested`, `coffee_fee`, `notes`, timestamps. Check constraint `ends_at > starts_at` plus length constraints on text fields.

**`public.workspaces.venue_request_token`** — nullable text, unique where not null; the public request link.

There is **no** exclusion constraint — overlaps are permitted at the DB level by design.

### RPCs (2)

- `get_venue_request_spaces(request_token text)` → active spaces for the workspace owning that token (id, name, description, capacity only).
- `submit_venue_request(request_token, target_space_id, booking_title, hirer_name, hirer_email, hirer_phone, starts_at, ends_at, request_notes)` → inserts a `Pending` / `external` / `source='public'` booking under the workspace owner's `user_id`. Forces status/source/type, accepts no money fields, and rate-limits to 20 public rows per workspace per hour. `revoke all from public` then `grant execute to anon, authenticated`.

### Storage

Bucket `venue-space-photos` (public read; insert/update/delete restricted to active workspace members, path-scoped by `workspace_id` as the first folder segment).

### Routes (3)

| Route | Element | Auth |
|---|---|---|
| `/venues` | `src/pages/Venues.tsx` → `VenuesPage` | inside `AppLayout` |
| `/venues/spaces` | `src/pages/VenueSpaces.tsx` → `VenueSpacesPage` | inside `AppLayout` |
| `/venue-request/:token` | `src/pages/PublicVenueRequest.tsx` | public, outside `AppLayout` |

All three are `React.lazy` in [src/App.tsx:48-50](src/App.tsx#L48-L50).

### Source files

| File | One-liner |
|---|---|
| [src/features/venues/api/venuesApi.ts](src/features/venues/api/venuesApi.ts) | All Supabase calls: `getVenueSpaces`, `upsertVenueSpace`, `setVenueSpaceActive`, `getVenueBookings`, `upsertVenueBooking`, `updateVenueBookingStatus`, `deleteVenueBooking`, `getVenueRequestToken`, `setVenueRequestToken`, `createHirerContact`. Zeroes all money fields when `booking_type = 'internal'` |
| [src/features/venues/api/venuesQueries.ts](src/features/venues/api/venuesQueries.ts) | TanStack Query hooks `useVenueSpaces`, `useVenueBookings`, `useVenueRequestToken` + exported key factories (`venueSpacesKey`, `venueBookingsKey`, `venueRequestTokenKey`) |
| [src/features/venues/lib/venueBookings.ts](src/features/venues/lib/venueBookings.ts) | Row types, the `VENUE_SPACE_FEATURES` fixed list (Projector, Kitchen, Air conditioning, Tables & chairs), pure `findConflicts()` (half-open overlap, ignores Cancelled and self), `bookingCoversDay()`, `formatBookingRange()`, `formatCurrency()` (ZAR / en-ZA) |
| [src/features/venues/lib/uploadVenueSpacePhoto.ts](src/features/venues/lib/uploadVenueSpacePhoto.ts) | Single-image upload to `venue-space-photos`, 5MB cap, image-only, returns public URL; mirrors `uploadProjectCover.ts` |
| [src/features/venues/pages/VenuesPage.tsx](src/features/venues/pages/VenuesPage.tsx) | `/venues`: month calendar + status filter (All/Pending/Confirmed/Cancelled) + booking list + booking modal. Queries a ±1-month window around the visible month |
| [src/features/venues/pages/VenueSpacesPage.tsx](src/features/venues/pages/VenueSpacesPage.tsx) | `/venues/spaces`: space cards (photo, capacity, rates, feature badges), create/edit modal, activate/deactivate, and the public-request-link create/revoke/copy card (revoke gated on `isAdmin`) |
| [src/features/venues/components/VenueCalendar.tsx](src/features/venues/components/VenueCalendar.tsx) | Monday-first 6×7 month grid, colour-coded chips per space (max 3/day + "+n more"), prev/today/next |
| [src/features/venues/components/VenueBookingList.tsx](src/features/venues/components/VenueBookingList.tsx) | Flat list of booking cards: status badge, "Request" badge for `source='public'`, hirer/fee/payment line, Open button |
| [src/features/venues/components/VenueBookingModal.tsx](src/features/venues/components/VenueBookingModal.tsx) | The big one (619 lines). Space/type/title/start/end/status; conflict alert with a "Book anyway" acknowledgement that resets when the clash set changes; external-only block for hirer + fee + deposit + payment status; "save hirer to Service Contacts"; requested extras (space features, PA system fee, tea & coffee fee); notes; delete with confirm |
| [src/features/venues/components/VenueSpaceEditorModal.tsx](src/features/venues/components/VenueSpaceEditorModal.tsx) | Create/edit a space: name, description, capacity, hourly/daily rate, colour, feature checkboxes, photo upload |
| [src/pages/Venues.tsx](src/pages/Venues.tsx), [src/pages/VenueSpaces.tsx](src/pages/VenueSpaces.tsx) | One-line re-export wrappers (the repo's legacy `src/pages/` route-shim convention) |
| [src/pages/PublicVenueRequest.tsx](src/pages/PublicVenueRequest.tsx) | Anonymous request form. Calls the two RPCs; whitelists the five RPC error strings and shows a generic message for anything else so Postgres internals never leak |

### Tests (4 files)

| File | Covers |
|---|---|
| [src/features/venues/lib/venueBookings.test.ts](src/features/venues/lib/venueBookings.test.ts) | `findConflicts` (partial/containing/contained/back-to-back/cancelled/pending/other-space/self/multiple) and `bookingCoversDay` |
| [src/features/venues/api/venuesApi.test.ts](src/features/venues/api/venuesApi.test.ts) | Insert vs update branching, internal-booking money zeroing, external retention, workspace + window filters |
| [src/features/venues/api/venuesQueries.test.ts](src/features/venues/api/venuesQueries.test.ts) | The three hooks under a real `QueryClientProvider` with the mocked Supabase chain |
| [src/features/venues/components/VenueBookingModal.test.tsx](src/features/venues/components/VenueBookingModal.test.tsx), [VenueCalendar.test.tsx](src/features/venues/components/VenueCalendar.test.tsx) | Component behaviour via Testing Library + mocked `venuesApi`/`sonner` |

### Background jobs

None for venues. Nothing is scheduled, emailed, or reminded automatically.

### Planning docs already in-repo

- [docs/superpowers/specs/2026-08-09-venue-hire-design.md](docs/superpowers/specs/2026-08-09-venue-hire-design.md) — the design that produced the current module.
- [docs/superpowers/plans/2026-08-09-venue-hire.md](docs/superpowers/plans/2026-08-09-venue-hire.md) — the task-by-task build plan (2576 lines), useful as a worked example of the expected plan format.
- [docs/superpowers/plans/2026-08-09-venue-hire-manual-verification.md](docs/superpowers/plans/2026-08-09-venue-hire-manual-verification.md), [docs/superpowers/plans/2026-08-10-venues-react-query-migration.md](docs/superpowers/plans/2026-08-10-venues-react-query-migration.md).

---

## 3. Neighbouring modules — integration surface today

### People

- Tables: `people`, `people_groups`, `people_group_members`, `people_group_folders`, `workspace_members`, `workspace_group_leaders`.
- Code: `src/features/people/{pages,components,lib}` — **no `api/` layer**; pages query Supabase directly (13 `supabase` references in `PeoplePage.tsx` alone).
- Reusable pickers already exist and are the right integration point for "assign a person": [src/components/people/PeopleSearchSelect.tsx](src/components/people/PeopleSearchSelect.tsx), [PeopleMultiSearchSelect.tsx](src/components/people/PeopleMultiSearchSelect.tsx), [PersonAvatar.tsx](src/components/people/PersonAvatar.tsx).
- `workspace_members.person_id` links an auth user to a person row; `useCurrentPerson.ts` resolves "who am I" as a person.
- **Venue link today:** none. `venue_bookings` links to `service_contacts`, not to `people`.

### Service Contacts (the outside-contact book)

- Tables: `service_contacts` (name, category, phone, email, address, notes, photo_url, last_used_at), `service_contact_logs` (usage log).
- Code: `src/features/people/pages/ServiceContacts*.tsx`, `src/features/people/components/ServiceContactEditorModal.tsx`.
- **Venue link today:** `venue_bookings.hirer_contact_id` FK + `createHirerContact()` inserts with `category: "Hirer"`. This is the only cross-module write venues performs.

### Calendar

- Tables: `calendar_events` (with `source` in `actsix|google|outlook|apple`), `calendar_sync_connections`, `calendar_feed_tokens`.
- Code: [src/pages/CalendarModule.tsx](src/pages/CalendarModule.tsx) — a single page that fetches four sources in parallel (calendar events, sync connections, tasks, **venue bookings**) and merges them into one in-memory `CalendarEvent[]`.
- **Venue link today:** read-only and one-way. `CalendarModule.tsx:225` calls `getVenueBookings({ workspaceId })`, maps them to `source: "venue"` chips, and clicking one navigates to `/venues`. Nothing is mirrored into `calendar_events`; `42P01` (table missing) is swallowed. Sync is via `supabase/functions/apple-calendar-sync`.
- There is **no** clash detection between a venue booking and any calendar event, task, service, or meeting. `findConflicts` only compares venue bookings against other venue bookings on the same space.

### Rostering (Service Planner)

- Tables: `service_types`, `service_instances`, `service_teams`, `service_team_members`, `service_team_roles`, `service_team_role_requirements`, `service_team_assignments`, `service_type_teams`, `service_order_items`, `service_order_templates`.
- Code: `src/features/service-planning/pages/*` — pages query Supabase directly, no `api/` layer.
- This is the closest existing analogue to §8 shift allocation: roles, required counts per role, per-person assignments with a status. It has **no** concept of hours, rates, pay, office hours, leave, or swaps.
- **Venue link today:** none.

### Finance / Payroll

- **Does not exist.** No invoices, no payment rails, no PSP, no timesheets, no payroll export, no `numeric` money anywhere except `venue_spaces.hourly_rate/daily_rate` and `venue_bookings.quoted_fee/deposit_amount/technician_fee/coffee_fee`.
- Payment tracking today = a four-value `payment_status` enum typed by staff.

### Communications

- In-app notifications: `public.notifications` + RPCs `actsix_create_notification_for_user`, `actsix_create_notification_for_person`, `actsix_notify_project_participants`, wrapped by [src/lib/notifications.ts](src/lib/notifications.ts); surfaced by [src/components/NotificationBell.tsx](src/components/NotificationBell.tsx). Several are fired by Postgres triggers.
- Outbound: only `supabase/functions/whatsapp-agent` (Twilio WhatsApp inbound/outbound, secret-gated). **No transactional email** and no email templating anywhere in the app.
- Reminders: `public.reminders` table + `/reminders` page — user-authored, read by the UI, not dispatched.

### Documents / assets

- No documents module. File handling is per-feature Supabase Storage buckets: `venue-space-photos`, `meeting-recordings`, `service-contact-photos`, `workspace-logos`, `training-course-covers`, `project-covers`. Each feature has its own `upload*.ts` in `lib/`.
- No PDF generation anywhere. Printing is done with print-styled React (`MeetingPrintSheet.tsx`) plus the browser's print dialog.

### Events (dormant)

`events`, `event_checklist_items`, `event_team_roles`, `event_logistics_items`, `event_registrations`, `event_registration_sheet_imports` exist in the database (migrations `20260612*`) and there is a public form (`src/pages/PublicEventRegistration.tsx` + `supabase/functions/event-registration-hosted-form`), **but the Event Management UI was deleted** (`.ai/CLAUDE.md` cites `EventManagement.tsx` as a removed god-component). These tables overlap heavily with the venue spec's run sheet / staffing / checklist concepts and should be an explicit decision in Phase 2, not an accident.

---

## 4. Conventions

### Folder structure

```
src/
  features/<domain>/
    api/        <domain>Api.ts (raw Supabase) + <domain>Queries.ts (TanStack hooks) + .test.ts
    components/ focused components + co-located .test.tsx
    hooks/
    lib/        pure logic, types, upload helpers + co-located .test.ts
    pages/      <Name>Page.tsx
    types/
  pages/        legacy flat routes + one-line re-export shims for feature pages
  components/   app-wide (AppLayout, AppSidebar, PageHeader) + components/ui/ (shadcn)
  hooks/        app-wide hooks
  lib/          app-wide helpers (modules, releaseMode, notifications, activityLog, utils)
  integrations/supabase/  client.ts, types.ts (generated, stale)
```

Newer domains (`venues`, `projects`, `tasks`, `meetings`, `dashboard`) follow the feature layout with an `api/` layer; older ones (`people`, `service-planning`) query Supabase from pages. `.ai/CLAUDE.md` says explicitly: don't retrofit the old ones unless that's the task.

### Naming

- Files: `PascalCase.tsx` for components/pages, `camelCase.ts` for logic/api, tests co-located as `<name>.test.ts(x)`.
- Pages exported `default`, named `<Thing>Page`, re-exported from `src/pages/<Thing>.tsx` as `export { default } from "@/features/…"`.
- DB columns `snake_case`; row types mirror the DB shape verbatim (`starts_at`, not `startsAt`). Function args in TS are `camelCase`, so payloads mix the two deliberately.
- Banned by `.ai/CLAUDE.md`: `Helper`, `Utils`, `Manager`, `Thing`, `Data`, `Misc`.
- Imports use the `@/` alias, never deep relative paths across features.

### Migration style

- Filename `YYYYMMDDHHMMSS_snake_case_description.sql`, no down-migration.
- Idempotent throughout: `create table if not exists`, `add column if not exists`, `create index if not exists`, policies wrapped in a `do $$ … if not exists (select 1 from pg_policies …) $$` guard, functions as `create or replace`.
- Every table: `id uuid primary key default gen_random_uuid()`, `workspace_id` FK `on delete cascade`, `user_id uuid not null`, `created_at`/`updated_at timestamptz not null default now()`.
- Optional text is `text not null default ''`, not nullable. Enums are `text` + `check (… in (…))`, not Postgres enums. Money is `numeric(10,2) not null default 0`.
- RLS on every table, policy body = "an active `workspace_members` row exists for `auth.uid()`".
- Anonymous access is never a table policy — always a `security definer` function with `set search_path = public, pg_temp`, `revoke all … from public`, then `grant execute … to anon`.
- Applied by hand (`npx supabase db push`), no migration step in any pipeline.

### Testing style

- Vitest with `globals: true`, jsdom, `@testing-library/react` + `jest-dom`.
- Supabase mocked via `vi.hoisted` + `vi.mock("@/integrations/supabase/client", …)` and `createQueryBuilder`/`okResult`/`errorResult` from [src/test/supabaseMock.ts](src/test/supabaseMock.ts). Add a chain method there rather than building a local mock.
- Test data built by a small factory function per file (`const booking = (overrides) => ({ …defaults, ...overrides })`).
- Pure logic is tested exhaustively including edge cases; components are tested for behaviour (what the user sees/clicks), not markup. Hooks are tested through a real `QueryClientProvider`.
- Tests live next to the code, never in a `__tests__/` directory.

### Comment style

Sparse but substantive: comments explain *why* a non-obvious decision was made (the ±1-month query window rationale in `VenuesPage.tsx`, the `.select("id")` note in `venuesApi.ts`, the half-open interval note on `findConflicts`), never *what* the line does. Prose uses an en dash, and the codebase uses `-` inside JSDoc rather than `—`.

### Commit / PR style

- Conventional commits with a scope: `feat(venues):`, `fix(venues):`, `refactor(venues):`, `docs(venues):`, `chore(tests):`. Subject is lowercase, imperative-ish, and often two clauses joined by "and" or a comma ("fix(venues): loading gate ignores spaces query, and vacuous refetch test").
- Small commits, one logical step each; feature branches named `feat/venue-hire`, `fix/inbox-project-status-default`, merged back with a merge commit.
- No PR template, no CODEOWNERS, no CI checks — verification is the local sequence in `.ai/CLAUDE.md`: `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm test`, `npm run build`, plus a manual browser pass for UI changes.

### Guardrails that constrain any new work here

From [.ai/CLAUDE.MD](.ai/CLAUDE.MD): ask before installing a dependency, creating a top-level folder, introducing a new architectural pattern, or duplicating logic; pause and confirm before touching more than 2–3 files; never bypass RLS; loading/empty/error states are part of "done".

---

## 5. Observations worth carrying into Phase 2

Stated as facts, not recommendations — they're the seams the gap analysis will land on.

1. **The current model is a booking calendar, not a hire lifecycle.** One row (`venue_bookings`) holds enquiry, quote, contract, and payment state simultaneously. There is no enquiry entity separate from a booking, no status beyond Pending/Confirmed/Cancelled, and no event that spans multiple spaces or multiple days as a single unit.
2. **A booking is one space × one time range.** A multi-day, multi-space event is N unrelated rows with no parent.
3. **Resources are a fixed four-item string list** (`VENUE_SPACE_FEATURES`), not an inventory with quantities or allocation.
4. **Clash detection is venue-internal only** — no read of `calendar_events`, `service_instances`, `meetings`, or group schedules.
5. **There is no scheduler and no outbound email.** Any spec feature phrased as "auto-remind", "auto-notify", or "auto-send" has no delivery mechanism in the codebase today.
6. **No money movement, no staff pay, no documents.** Fees are typed numbers on a booking; payment status is a manually-set enum.
7. **`src/integrations/supabase/types.ts` will not cover new venue tables** — new code should keep using the established `(supabase as any)` cast, or the types file needs regenerating (a separate decision).
8. **The dormant `events` tables** overlap the spec's run-sheet/staffing/checklist territory and are currently unreachable from the UI.
