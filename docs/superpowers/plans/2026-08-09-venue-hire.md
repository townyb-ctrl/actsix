# Venue Hire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Venue Hire module where a workspace defines bookable spaces and books them either internally (free) or as an external paid hire, with overlap warnings and a public request link.

**Architecture:** Two new Supabase tables (`venue_spaces`, `venue_bookings`) plus a `venue_request_token` column on `workspaces`. All Supabase calls live in `src/features/venues/api/venuesApi.ts`; overlap logic is one pure, unit-tested function in `src/features/venues/lib/venueBookings.ts`. Pages compose components and never query Supabase directly. Anonymous request submission goes through two `security definer` RPCs, so anon never gets a table policy. The existing Calendar module reads venue bookings as one more source — nothing is mirrored into `calendar_events`.

**Tech Stack:** React 18 + TypeScript, Vite, React Router, Tailwind + shadcn/ui, Supabase (Postgres + RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-09-venue-hire-design.md`

## Global Constraints

- No new npm dependencies. Everything here uses what is already installed.
- Follow `.ai/CLAUDE.md`: data access in `api/*.ts`, thin pages, focused components, no new `any` in new code (`(supabase as any)` casts are the established pattern for tables missing from generated types — new tables will not be in `src/integrations/supabase/types.ts`, so use that cast).
- Every table row carries `workspace_id` and `user_id`. RLS is scoped to active `workspace_members` rows, copying `supabase/migrations/20260612130000_create_calendar_module.sql`.
- Optional text columns are `text not null default ''`, never nullable, except where the spec explicitly says nullable. Required identifiers (`venue_spaces.name`, `venue_bookings.title`) are `text not null` with no default — a default of `''` would silently accept a blank name.
- Currency and dates render with the `en-ZA` locale, matching `src/pages/PublicEventRegistration.tsx`.
- Money fields apply only to `booking_type = 'external'`. Internal bookings store 0 / `'Not applicable'` and the UI hides those inputs entirely.
- Overlaps are warned about, never blocked. No database exclusion constraint.
- Verification per task: `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm test`. `npm run build` before declaring the whole plan done.
- Commit after every task.

---

### Task 1: Database schema, RLS, and public-request RPCs

**Files:**
- Create: `supabase/migrations/20260809120000_create_venue_hire.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `public.venue_spaces`, `public.venue_bookings`; column `public.workspaces.venue_request_token`; RPCs `get_venue_request_spaces(request_token text)` and `submit_venue_request(request_token text, target_space_id uuid, booking_title text, hirer_name text, hirer_email text, hirer_phone text, starts_at timestamptz, ends_at timestamptz, request_notes text)`.

- [ ] **Step 1: Create the migration file with both tables**

Create `supabase/migrations/20260809120000_create_venue_hire.sql`:

```sql
create table if not exists public.venue_spaces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  description text not null default '',
  capacity integer null,
  hourly_rate numeric(10,2) not null default 0,
  daily_rate numeric(10,2) not null default 0,
  color text not null default '',
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.venue_bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  space_id uuid not null references public.venue_spaces(id) on delete restrict,
  title text not null,
  booking_type text not null default 'internal' check (booking_type in ('internal', 'external')),
  hirer_contact_id uuid null references public.service_contacts(id) on delete set null,
  hirer_name text not null default '',
  hirer_email text not null default '',
  hirer_phone text not null default '',
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Cancelled')),
  quoted_fee numeric(10,2) not null default 0,
  deposit_amount numeric(10,2) not null default 0,
  payment_status text not null default 'Not applicable'
    check (payment_status in ('Not applicable', 'Unpaid', 'Deposit paid', 'Paid')),
  source text not null default 'staff' check (source in ('staff', 'public')),
  notes text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint venue_bookings_ends_after_starts check (ends_at > starts_at)
);

alter table public.workspaces
  add column if not exists venue_request_token text null;

create unique index if not exists workspaces_venue_request_token_idx
  on public.workspaces(venue_request_token)
  where venue_request_token is not null;

create index if not exists venue_spaces_workspace_idx
  on public.venue_spaces(workspace_id, name);

create index if not exists venue_bookings_workspace_start_idx
  on public.venue_bookings(workspace_id, starts_at);

create index if not exists venue_bookings_space_start_idx
  on public.venue_bookings(space_id, starts_at);

create index if not exists venue_bookings_status_idx
  on public.venue_bookings(workspace_id, status);
```

- [ ] **Step 2: Append RLS policies**

Append to the same file. This copies the guard style used in `20260612130000_create_calendar_module.sql` — a `do $$` block that checks `pg_policies` before creating, so the migration is re-runnable.

```sql
alter table public.venue_spaces enable row level security;
alter table public.venue_bookings enable row level security;

do $$
declare
  target record;
begin
  for target in
    select unnest(array['venue_spaces', 'venue_bookings']) as table_name
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = target.table_name
        and policyname = 'Workspace members manage venue records'
    ) then
      execute format($f$
        create policy %I on public.%I
          for all
          to authenticated
          using (
            exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = %I.workspace_id
                and wm.auth_user_id = auth.uid()
                and wm.status = 'active'
            )
          )
          with check (
            exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = %I.workspace_id
                and wm.auth_user_id = auth.uid()
                and wm.status = 'active'
            )
          )
      $f$, 'Workspace members manage venue records', target.table_name, target.table_name, target.table_name);
    end if;
  end loop;
end $$;
```

Note: no policy is created for the `anon` role on either table. Anonymous access happens only through the RPCs in the next step.

- [ ] **Step 3: Append the two public-request RPCs**

Append to the same file:

```sql
create or replace function public.get_venue_request_spaces(request_token text)
returns table (id uuid, name text, description text, capacity integer)
language sql
security definer
set search_path = public
as $$
  select s.id, s.name, s.description, s.capacity
  from public.venue_spaces s
  join public.workspaces w on w.id = s.workspace_id
  where w.venue_request_token is not null
    and w.venue_request_token = request_token
    and s.is_active
  order by s.name;
$$;

create or replace function public.submit_venue_request(
  request_token text,
  target_space_id uuid,
  booking_title text,
  hirer_name text,
  hirer_email text,
  hirer_phone text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  request_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  target_owner_id uuid;
begin
  if request_token is null or length(trim(request_token)) = 0 then
    raise exception 'This request link is no longer active.';
  end if;

  select w.id, w.owner_user_id into target_workspace_id, target_owner_id
  from public.workspaces w
  where w.venue_request_token = request_token;

  if target_workspace_id is null then
    raise exception 'This request link is no longer active.';
  end if;

  if not exists (
    select 1 from public.venue_spaces s
    where s.id = target_space_id
      and s.workspace_id = target_workspace_id
      and s.is_active
  ) then
    raise exception 'That space is not available for requests.';
  end if;

  if starts_at is null or ends_at is null or ends_at <= starts_at then
    raise exception 'The end time must be after the start time.';
  end if;

  if length(trim(coalesce(booking_title, ''))) = 0
     or length(trim(coalesce(hirer_name, ''))) = 0
     or length(trim(coalesce(hirer_email, ''))) = 0 then
    raise exception 'Please fill in the required fields.';
  end if;

  insert into public.venue_bookings (
    workspace_id, user_id, space_id, title, booking_type,
    hirer_name, hirer_email, hirer_phone,
    starts_at, ends_at, status, source, notes
  ) values (
    target_workspace_id, target_owner_id, target_space_id, trim(booking_title), 'external',
    trim(hirer_name), trim(hirer_email), trim(coalesce(hirer_phone, '')),
    starts_at, ends_at, 'Pending', 'public', coalesce(request_notes, '')
  );
end $$;

revoke all on function public.get_venue_request_spaces(text) from public;
revoke all on function public.submit_venue_request(
  text, uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, text
) from public;

grant execute on function public.get_venue_request_spaces(text) to anon, authenticated;
grant execute on function public.submit_venue_request(
  text, uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, text
) to anon, authenticated;
```

The RPC forces `status`, `source`, and `booking_type`, and never accepts fee inputs — a submitter cannot set their own price or approval state.

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db push`
Expected: the migration applies without error. If the Supabase CLI is not linked in this environment, apply the file's contents through the Supabase dashboard SQL editor instead, then continue.

- [ ] **Step 5: Verify the guard rails hold**

In the Supabase SQL editor, run:

```sql
select public.submit_venue_request(
  'definitely-not-a-real-token', gen_random_uuid(), 'Test', 'A', 'a@example.com', '',
  now(), now() + interval '1 hour', ''
);
```

Expected: `ERROR: This request link is no longer active.`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260809120000_create_venue_hire.sql
git commit -m "feat(venues): add venue spaces, bookings, and public request RPCs"
```

---

### Task 2: Booking types and conflict detection

**Files:**
- Create: `src/features/venues/lib/venueBookings.ts`
- Test: `src/features/venues/lib/venueBookings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type VenueBookingStatus = "Pending" | "Confirmed" | "Cancelled"`
  - `type VenueBookingType = "internal" | "external"`
  - `type VenuePaymentStatus = "Not applicable" | "Unpaid" | "Deposit paid" | "Paid"`
  - `type VenueSpace`, `type VenueBooking` (row shapes)
  - `findConflicts(candidate: ConflictCandidate, existing: VenueBooking[]): VenueBooking[]`
  - `type ConflictCandidate = { id?: string; spaceId: string; startsAt: string; endsAt: string }`

This is pure logic with no Supabase involvement, so it is written test-first.

- [ ] **Step 1: Write the failing test**

Create `src/features/venues/lib/venueBookings.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { findConflicts, type VenueBooking } from "./venueBookings";

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  title: "Existing booking",
  booking_type: "internal",
  hirer_contact_id: null,
  hirer_name: "",
  hirer_email: "",
  hirer_phone: "",
  starts_at: "2026-08-10T10:00:00.000Z",
  ends_at: "2026-08-10T12:00:00.000Z",
  status: "Confirmed",
  quoted_fee: 0,
  deposit_amount: 0,
  payment_status: "Not applicable",
  source: "staff",
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const candidate = {
  spaceId: "hall",
  startsAt: "2026-08-10T11:00:00.000Z",
  endsAt: "2026-08-10T13:00:00.000Z",
};

describe("findConflicts", () => {
  it("returns a booking that partially overlaps the candidate", () => {
    const existing = booking({ id: "b1" });

    expect(findConflicts(candidate, [existing])).toEqual([existing]);
  });

  it("returns a booking that fully contains the candidate", () => {
    const existing = booking({
      id: "b1",
      starts_at: "2026-08-10T09:00:00.000Z",
      ends_at: "2026-08-10T18:00:00.000Z",
    });

    expect(findConflicts(candidate, [existing])).toEqual([existing]);
  });

  it("returns a booking the candidate fully contains", () => {
    const existing = booking({
      id: "b1",
      starts_at: "2026-08-10T11:30:00.000Z",
      ends_at: "2026-08-10T11:45:00.000Z",
    });

    expect(findConflicts(candidate, [existing])).toEqual([existing]);
  });

  it("treats back-to-back bookings as no conflict", () => {
    const before = booking({
      id: "b1",
      starts_at: "2026-08-10T09:00:00.000Z",
      ends_at: "2026-08-10T11:00:00.000Z",
    });
    const after = booking({
      id: "b2",
      starts_at: "2026-08-10T13:00:00.000Z",
      ends_at: "2026-08-10T15:00:00.000Z",
    });

    expect(findConflicts(candidate, [before, after])).toEqual([]);
  });

  it("ignores cancelled bookings", () => {
    const existing = booking({ id: "b1", status: "Cancelled" });

    expect(findConflicts(candidate, [existing])).toEqual([]);
  });

  it("conflicts with pending bookings, not only confirmed ones", () => {
    const existing = booking({ id: "b1", status: "Pending" });

    expect(findConflicts(candidate, [existing])).toEqual([existing]);
  });

  it("ignores bookings in a different space", () => {
    const existing = booking({ id: "b1", space_id: "chapel" });

    expect(findConflicts(candidate, [existing])).toEqual([]);
  });

  it("excludes the candidate's own row when editing", () => {
    const existing = booking({ id: "b1" });

    expect(findConflicts({ ...candidate, id: "b1" }, [existing])).toEqual([]);
  });

  it("returns every conflicting booking", () => {
    const first = booking({ id: "b1" });
    const second = booking({
      id: "b2",
      starts_at: "2026-08-10T12:30:00.000Z",
      ends_at: "2026-08-10T14:00:00.000Z",
    });

    expect(findConflicts(candidate, [first, second])).toEqual([first, second]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/venues/lib/venueBookings.test.ts`
Expected: FAIL — cannot resolve `./venueBookings`.

- [ ] **Step 3: Write the implementation**

Create `src/features/venues/lib/venueBookings.ts`:

```ts
export type VenueBookingStatus = "Pending" | "Confirmed" | "Cancelled";
export type VenueBookingType = "internal" | "external";
export type VenuePaymentStatus = "Not applicable" | "Unpaid" | "Deposit paid" | "Paid";
export type VenueBookingSource = "staff" | "public";

export type VenueSpace = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  description: string;
  capacity: number | null;
  hourly_rate: number;
  daily_rate: number;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VenueBooking = {
  id: string;
  workspace_id: string;
  user_id: string;
  space_id: string;
  title: string;
  booking_type: VenueBookingType;
  hirer_contact_id: string | null;
  hirer_name: string;
  hirer_email: string;
  hirer_phone: string;
  starts_at: string;
  ends_at: string;
  status: VenueBookingStatus;
  quoted_fee: number;
  deposit_amount: number;
  payment_status: VenuePaymentStatus;
  source: VenueBookingSource;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ConflictCandidate = {
  /** Present when editing - the booking never conflicts with itself. */
  id?: string;
  spaceId: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Bookings on the same space whose time ranges overlap the candidate.
 * Ranges are half-open: a booking ending at 12:00 does not conflict with one
 * starting at 12:00, because back-to-back hires are routine, not a mistake.
 * Overlaps are surfaced as a warning - the caller decides whether to proceed.
 */
export const findConflicts = (
  candidate: ConflictCandidate,
  existing: VenueBooking[]
): VenueBooking[] => {
  const candidateStart = new Date(candidate.startsAt).getTime();
  const candidateEnd = new Date(candidate.endsAt).getTime();

  return existing.filter((booking) => {
    if (booking.id === candidate.id) return false;
    if (booking.space_id !== candidate.spaceId) return false;
    if (booking.status === "Cancelled") return false;

    return (
      new Date(booking.starts_at).getTime() < candidateEnd &&
      new Date(booking.ends_at).getTime() > candidateStart
    );
  });
};

export const formatBookingRange = (startsAt: string, endsAt: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  const time = (value: Date) =>
    value.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return `${date}, ${time(start)}–${time(end)}`;

  const endDate = end.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  return `${date} ${time(start)} – ${endDate} ${time(end)}`;
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount || 0);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/venues/lib/venueBookings.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/venues/lib/venueBookings.ts src/features/venues/lib/venueBookings.test.ts
git commit -m "feat(venues): add booking types and overlap detection"
```

---

### Task 3: Data access layer

**Files:**
- Create: `src/features/venues/api/venuesApi.ts`
- Test: `src/features/venues/api/venuesApi.test.ts`
- Modify: `src/test/supabaseMock.ts` (add `gte`, `lte`, `is`, `rpc`-free chain methods)

**Interfaces:**
- Consumes: types from `src/features/venues/lib/venueBookings.ts`.
- Produces:
  - `getVenueSpaces(workspaceId: string | null | undefined)`
  - `upsertVenueSpace({ spaceId, workspaceId, userId, payload }: { spaceId?: string; workspaceId: string; userId: string; payload: VenueSpacePayload })`
  - `setVenueSpaceActive(spaceId: string, isActive: boolean)`
  - `getVenueBookings({ workspaceId, fromIso, toIso }: { workspaceId: string | null | undefined; fromIso?: string; toIso?: string })`
  - `upsertVenueBooking({ bookingId, workspaceId, userId, payload }: { bookingId?: string; workspaceId: string; userId: string; payload: VenueBookingPayload })`
  - `updateVenueBookingStatus(bookingId: string, status: VenueBookingStatus)`
  - `deleteVenueBooking(bookingId: string)`
  - `getVenueRequestToken(workspaceId: string)`, `setVenueRequestToken(workspaceId: string, token: string | null)`
  - `createHirerContact({ workspaceId, userId, name, email, phone }: {...})`
  - `type VenueSpacePayload`, `type VenueBookingPayload`

- [ ] **Step 1: Add the missing chain methods to the shared Supabase mock**

In `src/test/supabaseMock.ts`, extend the `CHAIN_METHODS` array so range queries can be asserted on:

```ts
const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
  "eq",
  "neq",
  "in",
  "gte",
  "lte",
  "order",
  "limit",
  "match",
] as const;
```

Nothing else in that file changes.

- [ ] **Step 2: Write the failing test**

Create `src/features/venues/api/venuesApi.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { getVenueBookings, upsertVenueBooking, upsertVenueSpace } from "./venuesApi";

describe("upsertVenueSpace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("inserts a new space with the workspace and creator attached", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueSpace({
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { name: "Main Hall", description: "", capacity: 200, hourly_rate: 250, daily_rate: 1500, color: "" },
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_spaces");
    expect(builder.insert).toHaveBeenCalledWith({
      name: "Main Hall",
      description: "",
      capacity: 200,
      hourly_rate: 250,
      daily_rate: 1500,
      color: "",
      workspace_id: "workspace-1",
      user_id: "user-1",
    });
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("updates an existing space without rewriting its workspace", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueSpace({
      spaceId: "space-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { name: "Renamed Hall" },
    });

    expect(builder.update).toHaveBeenCalledWith({ name: "Renamed Hall" });
    expect(builder.eq).toHaveBeenCalledWith("id", "space-1");
    expect(builder.insert).not.toHaveBeenCalled();
  });
});

describe("upsertVenueBooking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("zeroes the money fields on an internal booking", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueBooking({
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: {
        space_id: "space-1",
        title: "Youth night",
        booking_type: "internal",
        starts_at: "2026-08-10T17:00:00.000Z",
        ends_at: "2026-08-10T20:00:00.000Z",
        status: "Confirmed",
        quoted_fee: 900,
        deposit_amount: 300,
        payment_status: "Unpaid",
      },
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_bookings");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_type: "internal",
        quoted_fee: 0,
        deposit_amount: 0,
        payment_status: "Not applicable",
        hirer_contact_id: null,
        hirer_name: "",
        hirer_email: "",
        hirer_phone: "",
      })
    );
  });

  it("keeps the money fields on an external booking", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueBooking({
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: {
        space_id: "space-1",
        title: "Robertson wedding",
        booking_type: "external",
        hirer_name: "Dana Robertson",
        hirer_email: "dana@example.com",
        starts_at: "2026-08-15T09:00:00.000Z",
        ends_at: "2026-08-15T17:00:00.000Z",
        status: "Confirmed",
        quoted_fee: 4500,
        deposit_amount: 1000,
        payment_status: "Deposit paid",
      },
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_type: "external",
        quoted_fee: 4500,
        deposit_amount: 1000,
        payment_status: "Deposit paid",
        hirer_name: "Dana Robertson",
      })
    );
  });
});

describe("getVenueBookings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("filters to the workspace and the requested window", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getVenueBookings({
      workspaceId: "workspace-1",
      fromIso: "2026-08-01T00:00:00.000Z",
      toIso: "2026-08-31T23:59:59.999Z",
    });

    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(builder.gte).toHaveBeenCalledWith("starts_at", "2026-08-01T00:00:00.000Z");
    expect(builder.lte).toHaveBeenCalledWith("starts_at", "2026-08-31T23:59:59.999Z");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/features/venues/api/venuesApi.test.ts`
Expected: FAIL — cannot resolve `./venuesApi`.

- [ ] **Step 4: Write the implementation**

Create `src/features/venues/api/venuesApi.ts`:

```ts
import { supabase } from "@/integrations/supabase/client";

import type {
  VenueBookingStatus,
  VenueBookingType,
  VenuePaymentStatus,
} from "@/features/venues/lib/venueBookings";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export type VenueSpacePayload = {
  name?: string;
  description?: string;
  capacity?: number | null;
  hourly_rate?: number;
  daily_rate?: number;
  color?: string;
  is_active?: boolean;
};

export type VenueBookingPayload = {
  space_id: string;
  title: string;
  booking_type: VenueBookingType;
  hirer_contact_id?: string | null;
  hirer_name?: string;
  hirer_email?: string;
  hirer_phone?: string;
  starts_at: string;
  ends_at: string;
  status: VenueBookingStatus;
  quoted_fee?: number;
  deposit_amount?: number;
  payment_status?: VenuePaymentStatus;
  notes?: string;
};

export const getVenueSpaces = (workspaceId?: string | null) =>
  (supabase as any)
    .from("venue_spaces")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("name", { ascending: true });

export const upsertVenueSpace = ({
  spaceId,
  workspaceId,
  userId,
  payload,
}: {
  spaceId?: string;
  workspaceId: string;
  userId: string;
  payload: VenueSpacePayload;
}) => {
  const table = (supabase as any).from("venue_spaces");

  if (spaceId) return table.update(payload).eq("id", spaceId);

  return table.insert({ ...payload, workspace_id: workspaceId, user_id: userId });
};

export const setVenueSpaceActive = (spaceId: string, isActive: boolean) =>
  (supabase as any).from("venue_spaces").update({ is_active: isActive }).eq("id", spaceId);

export const getVenueBookings = ({
  workspaceId,
  fromIso,
  toIso,
}: {
  workspaceId?: string | null;
  fromIso?: string;
  toIso?: string;
}) => {
  let query = (supabase as any)
    .from("venue_bookings")
    .select("*")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("starts_at", { ascending: true });

  if (fromIso) query = query.gte("starts_at", fromIso);
  if (toIso) query = query.lte("starts_at", toIso);

  return query;
};

/**
 * Money only ever lands on an external booking - an internal one is stored
 * with zeroed fees so a booking that switches type never leaves a stale price
 * behind.
 */
export const upsertVenueBooking = ({
  bookingId,
  workspaceId,
  userId,
  payload,
}: {
  bookingId?: string;
  workspaceId: string;
  userId: string;
  payload: VenueBookingPayload;
}) => {
  const isExternal = payload.booking_type === "external";

  const row = {
    space_id: payload.space_id,
    title: payload.title,
    booking_type: payload.booking_type,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
    status: payload.status,
    notes: payload.notes ?? "",
    hirer_contact_id: isExternal ? payload.hirer_contact_id ?? null : null,
    hirer_name: isExternal ? payload.hirer_name ?? "" : "",
    hirer_email: isExternal ? payload.hirer_email ?? "" : "",
    hirer_phone: isExternal ? payload.hirer_phone ?? "" : "",
    quoted_fee: isExternal ? payload.quoted_fee ?? 0 : 0,
    deposit_amount: isExternal ? payload.deposit_amount ?? 0 : 0,
    payment_status: isExternal ? payload.payment_status ?? "Unpaid" : "Not applicable",
  };

  const table = (supabase as any).from("venue_bookings");

  if (bookingId) return table.update({ ...row, updated_at: new Date().toISOString() }).eq("id", bookingId);

  return table.insert({ ...row, workspace_id: workspaceId, user_id: userId });
};

export const updateVenueBookingStatus = (bookingId: string, status: VenueBookingStatus) =>
  (supabase as any)
    .from("venue_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId);

export const deleteVenueBooking = (bookingId: string) =>
  (supabase as any).from("venue_bookings").delete().eq("id", bookingId);

export const getVenueRequestToken = (workspaceId: string) =>
  (supabase as any)
    .from("workspaces")
    .select("venue_request_token")
    .eq("id", workspaceId)
    .maybeSingle();

export const setVenueRequestToken = (workspaceId: string, token: string | null) =>
  (supabase as any).from("workspaces").update({ venue_request_token: token }).eq("id", workspaceId);

/** Promotes an approved public request's raw hirer details into the shared contact book. */
export const createHirerContact = ({
  workspaceId,
  userId,
  name,
  email,
  phone,
}: {
  workspaceId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
}) =>
  (supabase as any)
    .from("service_contacts")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      name,
      email,
      phone,
      category: "Hirer",
    })
    .select("id")
    .single();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/api/venuesApi.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run the full suite, typecheck, and commit**

```bash
npm test
npx tsc -p tsconfig.app.json --noEmit
git add src/features/venues/api src/test/supabaseMock.ts
git commit -m "feat(venues): add venue data access layer"
```

Expected: the whole suite passes — the `supabaseMock` change is additive, so existing tests are unaffected.

---

### Task 4: Register the module, its routes, and the spaces page

**Files:**
- Modify: `src/lib/releaseMode.ts` (add `venues` to `ActsixModuleKey` and the three module maps)
- Modify: `src/lib/modules.ts` (add `venues` to `ActiveModuleKey`, `OPTIONAL_MODULES`, `DEFAULT_ACTIVE_MODULES`, `MODULE_LABELS`, `MODULE_DESCRIPTIONS`, `getModuleKeyForPath`)
- Modify: `src/components/AppSidebar.tsx` (one nav section)
- Modify: `src/App.tsx` (three routes)
- Create: `src/features/venues/pages/VenueSpacesPage.tsx`
- Create: `src/features/venues/components/VenueSpaceEditorModal.tsx`
- Create: `src/pages/Venues.tsx`, `src/pages/VenueSpaces.tsx` (thin route wrappers, matching how `src/pages/Projects.tsx` wraps its feature page)

**Interfaces:**
- Consumes: `getVenueSpaces`, `upsertVenueSpace`, `setVenueSpaceActive` from Task 3; `VenueSpace` from Task 2.
- Produces: routes `/venues`, `/venues/spaces`, `/venue-request/:token`; module key `"venues"`.

- [ ] **Step 1: Add the module key**

In `src/lib/releaseMode.ts`, add `| "venues"` to the `ActsixModuleKey` union, then add `venues: true` to `alphaModules` and `fullModules`. `betaModules` spreads `alphaModules`, so it needs no change.

In `src/lib/modules.ts`:

```ts
export type ActiveModuleKey = Extract<
  ActsixModuleKey,
  "home" | "tasks" | "people" | "groups" | "meetings" | "service_planner" | "sermon_hub" | "calendar" | "venues"
>;

export const OPTIONAL_MODULES: ActiveModuleKey[] = ["groups", "meetings", "service_planner", "calendar", "sermon_hub", "venues"];
```

Add `venues: false` to `DEFAULT_ACTIVE_MODULES` (off by default — most workspaces do not hire out their building), `venues: "Venue Hire"` to `MODULE_LABELS`, and to `MODULE_DESCRIPTIONS`:

```ts
venues: "Bookable spaces, internal reservations, and external hire with fees.",
```

Then in `getModuleKeyForPath`, above the final `return "home"`:

```ts
if (pathname === "/venues" || pathname.startsWith("/venues/")) return "venues";
```

- [ ] **Step 2: Verify the type union is exhaustive**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS. If any `Record<ActiveModuleKey, boolean>` map is missing the new key, TypeScript names the file — add `venues` there too and re-run.

- [ ] **Step 3: Add the sidebar section**

In `src/components/AppSidebar.tsx`, add `Building2` and `DoorOpen` to the existing `lucide-react` import, then insert this section into the nav array immediately after the `service_planner` section:

```tsx
  {
    id: "venues",
    title: "Venue Hire",
    url: "/venues",
    icon: Building2,
    moduleKey: "venues",
    matchPrefixes: ["/venues"],
    group: "Planning",
    items: [
      { title: "Bookings", url: "/venues", icon: CalendarDays },
      { title: "Spaces", url: "/venues/spaces", icon: DoorOpen },
    ],
  },
```

- [ ] **Step 4: Create the route wrappers**

Create `src/pages/Venues.tsx`:

```tsx
export { default } from "@/features/venues/pages/VenuesPage";
```

Create `src/pages/VenueSpaces.tsx`:

```tsx
export { default } from "@/features/venues/pages/VenueSpacesPage";
```

`VenuesPage` does not exist until Task 5. To keep this task independently testable, create a minimal `src/features/venues/pages/VenuesPage.tsx` now that Task 5 replaces wholesale:

```tsx
export default function VenuesPage() {
  return null;
}
```

- [ ] **Step 5: Add the routes**

In `src/App.tsx`, import the pages alongside the existing page imports:

```tsx
import Venues from "./pages/Venues";
import VenueSpaces from "./pages/VenueSpaces";
import PublicVenueRequest from "./pages/PublicVenueRequest";
```

Add the public route next to the existing `/register/:token` line, outside the authenticated group:

```tsx
<Route path="/venue-request/:token" element={<PublicVenueRequest />} />
```

And inside the authenticated group, after the service-planner routes:

```tsx
<Route path="/venues" element={<Venues />} />
<Route path="/venues/spaces" element={<VenueSpaces />} />
```

`PublicVenueRequest` is built in Task 6. Create a placeholder now so the import resolves — `src/pages/PublicVenueRequest.tsx`:

```tsx
export default function PublicVenueRequest() {
  return null;
}
```

- [ ] **Step 6: Build the spaces page**

Create `src/features/venues/pages/VenueSpacesPage.tsx`. It loads spaces for the current workspace, renders them as cards with rates and capacity, opens the editor modal for create and edit, and deactivates rather than deletes.

```tsx
import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { getVenueSpaces, setVenueSpaceActive } from "@/features/venues/api/venuesApi";
import { formatCurrency, type VenueSpace } from "@/features/venues/lib/venueBookings";
import VenueSpaceEditorModal from "@/features/venues/components/VenueSpaceEditorModal";

export default function VenueSpacesPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();

  const [spaces, setSpaces] = useState<VenueSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSpace, setEditingSpace] = useState<VenueSpace | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadSpaces = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    const { data, error } = await getVenueSpaces(workspace.id);
    if (error) {
      toast.error("Could not load spaces", { description: error.message });
    }
    setSpaces((data as VenueSpace[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSpaces();
  }, [workspace?.id]);

  const toggleActive = async (space: VenueSpace) => {
    const { error } = await setVenueSpaceActive(space.id, !space.is_active);
    if (error) {
      toast.error("Could not update the space", { description: error.message });
      return;
    }
    loadSpaces();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Spaces</h1>
          <p className="text-sm text-muted-foreground">
            The rooms and halls that can be booked or hired.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingSpace(null);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add space
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading spaces…</p>
      ) : spaces.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No spaces yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add the hall, chapel, or meeting rooms people book. You need at least one space
              before anything can be booked.
            </p>
            <Button
              onClick={() => {
                setEditingSpace(null);
                setModalOpen(true);
              }}
            >
              Add your first space
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <Card key={space.id} className={space.is_active ? "" : "opacity-60"}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <CardTitle className="text-base">{space.name}</CardTitle>
                {!space.is_active && <Badge variant="secondary">Inactive</Badge>}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {space.description && <p className="text-muted-foreground">{space.description}</p>}
                <dl className="space-y-1 text-muted-foreground">
                  {space.capacity != null && (
                    <div className="flex justify-between">
                      <dt>Capacity</dt>
                      <dd>{space.capacity}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt>Hourly hire</dt>
                    <dd>{formatCurrency(space.hourly_rate)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Daily hire</dt>
                    <dd>{formatCurrency(space.daily_rate)}</dd>
                  </div>
                </dl>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSpace(space);
                      setModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(space)}>
                    {space.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VenueSpaceEditorModal
        open={modalOpen}
        space={editingSpace}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setModalOpen}
        onSaved={loadSpaces}
      />
    </div>
  );
}
```

- [ ] **Step 7: Build the space editor modal**

Create `src/features/venues/components/VenueSpaceEditorModal.tsx`:

```tsx
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { upsertVenueSpace } from "@/features/venues/api/venuesApi";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";

type Props = {
  open: boolean;
  space: VenueSpace | null;
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export default function VenueSpaceEditorModal({
  open,
  space,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [dailyRate, setDailyRate] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(space?.name || "");
    setDescription(space?.description || "");
    setCapacity(space?.capacity != null ? String(space.capacity) : "");
    setHourlyRate(String(space?.hourly_rate ?? 0));
    setDailyRate(String(space?.daily_rate ?? 0));
  }, [open, space]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Give the space a name");
      return;
    }
    if (!workspaceId || !userId) {
      toast.error("No active workspace");
      return;
    }

    setSaving(true);
    const { error } = await upsertVenueSpace({
      spaceId: space?.id,
      workspaceId,
      userId,
      payload: {
        name: name.trim(),
        description: description.trim(),
        capacity: capacity.trim() ? Number(capacity) : null,
        hourly_rate: Number(hourlyRate) || 0,
        daily_rate: Number(dailyRate) || 0,
      },
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the space", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{space ? "Edit space" : "Add space"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="venue-space-name">Name</Label>
            <Input
              id="venue-space-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main Hall"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-space-description">Description</Label>
            <Textarea
              id="venue-space-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="venue-space-capacity">Capacity</Label>
              <Input
                id="venue-space-capacity"
                type="number"
                min="0"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-space-hourly">Hourly hire</Label>
              <Input
                id="venue-space-hourly"
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-space-daily">Daily hire</Label>
              <Input
                id="venue-space-daily"
                type="number"
                min="0"
                step="0.01"
                value={dailyRate}
                onChange={(event) => setDailyRate(event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Rates pre-fill the fee on a new external hire. Changing them never alters bookings
            already made.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Verify in the browser**

Run: `npm run dev`
Visit Settings and switch the Venue Hire module on, then visit `/venues/spaces`.
Expected: the empty state renders; adding "Main Hall" with a capacity and rates saves and appears as a card; editing it persists; Deactivate greys it out and flips the button to Reactivate. No console errors.

- [ ] **Step 9: Typecheck, lint, and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
git add src/lib/releaseMode.ts src/lib/modules.ts src/components/AppSidebar.tsx src/App.tsx src/pages/Venues.tsx src/pages/VenueSpaces.tsx src/pages/PublicVenueRequest.tsx src/features/venues
git commit -m "feat(venues): register the module and add space management"
```

---

### Task 5: Bookings page, list, and booking modal

**Files:**
- Replace: `src/features/venues/pages/VenuesPage.tsx` (the Task 4 placeholder)
- Create: `src/features/venues/components/VenueBookingList.tsx`
- Create: `src/features/venues/components/VenueBookingModal.tsx`

**Interfaces:**
- Consumes: `getVenueSpaces`, `getVenueBookings`, `upsertVenueBooking`, `updateVenueBookingStatus`, `createHirerContact` from Task 3; `findConflicts`, `formatBookingRange`, `formatCurrency`, `VenueBooking`, `VenueSpace` from Task 2.
- Produces: the `/venues` screen. No exports other tasks depend on.

- [ ] **Step 1: Build the booking list component**

Create `src/features/venues/components/VenueBookingList.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatBookingRange,
  formatCurrency,
  type VenueBooking,
  type VenueSpace,
} from "@/features/venues/lib/venueBookings";

type Props = {
  bookings: VenueBooking[];
  spaces: VenueSpace[];
  onEdit: (booking: VenueBooking) => void;
};

const statusVariant = (status: VenueBooking["status"]) => {
  if (status === "Confirmed") return "default" as const;
  if (status === "Pending") return "secondary" as const;
  return "outline" as const;
};

export default function VenueBookingList({ bookings, spaces, onEdit }: Props) {
  const spaceName = (spaceId: string) =>
    spaces.find((space) => space.id === spaceId)?.name || "Unknown space";

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nothing booked for this filter.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {bookings.map((booking) => (
        <Card key={booking.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{booking.title}</p>
                <Badge variant={statusVariant(booking.status)}>{booking.status}</Badge>
                {booking.source === "public" && <Badge variant="outline">Request</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {spaceName(booking.space_id)} · {formatBookingRange(booking.starts_at, booking.ends_at)}
              </p>
              {booking.booking_type === "external" && (
                <p className="text-sm text-muted-foreground">
                  {booking.hirer_name || "Hirer not named"} · {formatCurrency(booking.quoted_fee)} ·{" "}
                  {booking.payment_status}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(booking)}>
              Open
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Build the booking modal**

Create `src/features/venues/components/VenueBookingModal.tsx`. This is the module's most detailed component: it switches money fields on booking type, warns on conflicts without blocking, and offers to save a public request's hirer into the contact book on approval.

```tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createHirerContact, upsertVenueBooking } from "@/features/venues/api/venuesApi";
import {
  findConflicts,
  formatBookingRange,
  type VenueBooking,
  type VenueBookingStatus,
  type VenueBookingType,
  type VenuePaymentStatus,
  type VenueSpace,
} from "@/features/venues/lib/venueBookings";

type Props = {
  open: boolean;
  booking: VenueBooking | null;
  spaces: VenueSpace[];
  bookings: VenueBooking[];
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

/** <input type="datetime-local"> wants local time with no zone; the DB stores UTC. */
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInput = (value: string) => new Date(value).toISOString();

const defaultStart = () => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return toLocalInput(start.toISOString());
};

const defaultEnd = () => {
  const end = new Date();
  end.setMinutes(0, 0, 0);
  end.setHours(end.getHours() + 3);
  return toLocalInput(end.toISOString());
};

export default function VenueBookingModal({
  open,
  booking,
  spaces,
  bookings,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {

  const activeSpaces = spaces.filter((space) => space.is_active || space.id === booking?.space_id);

  const [spaceId, setSpaceId] = useState("");
  const [title, setTitle] = useState("");
  const [bookingType, setBookingType] = useState<VenueBookingType>("internal");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [status, setStatus] = useState<VenueBookingStatus>("Confirmed");
  const [hirerName, setHirerName] = useState("");
  const [hirerEmail, setHirerEmail] = useState("");
  const [hirerPhone, setHirerPhone] = useState("");
  const [quotedFee, setQuotedFee] = useState("0");
  const [depositAmount, setDepositAmount] = useState("0");
  const [paymentStatus, setPaymentStatus] = useState<VenuePaymentStatus>("Unpaid");
  const [notes, setNotes] = useState("");
  const [saveHirerAsContact, setSaveHirerAsContact] = useState(false);
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSpaceId(booking?.space_id || activeSpaces[0]?.id || "");
    setTitle(booking?.title || "");
    setBookingType(booking?.booking_type || "internal");
    setStartsAt(booking ? toLocalInput(booking.starts_at) : defaultStart());
    setEndsAt(booking ? toLocalInput(booking.ends_at) : defaultEnd());
    setStatus(booking?.status || "Confirmed");
    setHirerName(booking?.hirer_name || "");
    setHirerEmail(booking?.hirer_email || "");
    setHirerPhone(booking?.hirer_phone || "");
    setQuotedFee(String(booking?.quoted_fee ?? 0));
    setDepositAmount(String(booking?.deposit_amount ?? 0));
    setPaymentStatus(booking?.payment_status && booking.payment_status !== "Not applicable"
      ? booking.payment_status
      : "Unpaid");
    setNotes(booking?.notes || "");
    setSaveHirerAsContact(false);
    setOverrideConflict(false);
  }, [open, booking]);

  /** Pre-fill the fee from the space's daily rate when creating an external hire. */
  useEffect(() => {
    if (booking || bookingType !== "external") return;
    const space = spaces.find((candidate) => candidate.id === spaceId);
    if (space) setQuotedFee(String(space.daily_rate || 0));
  }, [spaceId, bookingType, booking, spaces]);

  const conflicts = useMemo(() => {
    if (!spaceId || !startsAt || !endsAt) return [];
    return findConflicts(
      { id: booking?.id, spaceId, startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt) },
      bookings
    );
  }, [spaceId, startsAt, endsAt, bookings, booking?.id]);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!spaceId) {
      toast.error("Choose a space");
      return;
    }
    if (!title.trim()) {
      toast.error("Give the booking a title");
      return;
    }
    if (new Date(fromLocalInput(endsAt)) <= new Date(fromLocalInput(startsAt))) {
      toast.error("The end time must be after the start time");
      return;
    }
    if (bookingType === "external" && !hirerName.trim()) {
      toast.error("Name the hirer");
      return;
    }
    if (conflicts.length > 0 && !overrideConflict) {
      toast.error("This clashes with another booking", {
        description: "Tick “Book anyway” to keep both.",
      });
      return;
    }

    setSaving(true);

    let hirerContactId = booking?.hirer_contact_id ?? null;

    if (saveHirerAsContact && bookingType === "external" && hirerName.trim()) {
      const { data, error } = await createHirerContact({
        workspaceId,
        userId,
        name: hirerName.trim(),
        email: hirerEmail.trim(),
        phone: hirerPhone.trim(),
      });
      if (error) {
        toast.error("Could not save the hirer as a contact", { description: error.message });
      } else {
        hirerContactId = (data as { id: string })?.id ?? null;
      }
    }

    const { error } = await upsertVenueBooking({
      bookingId: booking?.id,
      workspaceId,
      userId,
      payload: {
        space_id: spaceId,
        title: title.trim(),
        booking_type: bookingType,
        hirer_contact_id: hirerContactId,
        hirer_name: hirerName.trim(),
        hirer_email: hirerEmail.trim(),
        hirer_phone: hirerPhone.trim(),
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
        status,
        quoted_fee: Number(quotedFee) || 0,
        deposit_amount: Number(depositAmount) || 0,
        payment_status: paymentStatus,
        notes: notes.trim(),
      },
    });

    setSaving(false);

    if (error) {
      toast.error("Could not save the booking", { description: error.message });
      return;
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{booking ? "Booking" : "New booking"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={save}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue-booking-space">Space</Label>
              <Select value={spaceId} onValueChange={setSpaceId}>
                <SelectTrigger id="venue-booking-space">
                  <SelectValue placeholder="Choose a space" />
                </SelectTrigger>
                <SelectContent>
                  {activeSpaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-booking-type">Type</Label>
              <Select
                value={bookingType}
                onValueChange={(value) => setBookingType(value as VenueBookingType)}
              >
                <SelectTrigger id="venue-booking-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (no charge)</SelectItem>
                  <SelectItem value="external">External hire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue-booking-title">Title</Label>
            <Input
              id="venue-booking-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={bookingType === "external" ? "Robertson wedding" : "Youth night"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="venue-booking-start">Starts</Label>
              <Input
                id="venue-booking-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-booking-end">Ends</Label>
              <Input
                id="venue-booking-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-booking-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as VenueBookingStatus)}>
                <SelectTrigger id="venue-booking-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {conflicts.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Clashes with {conflicts.length === 1 ? "another booking" : `${conflicts.length} bookings`}</AlertTitle>
              <AlertDescription className="space-y-2">
                <ul className="list-disc pl-4 text-sm">
                  {conflicts.map((conflict) => (
                    <li key={conflict.id}>
                      {conflict.title} ({conflict.status.toLowerCase()}) ·{" "}
                      {formatBookingRange(conflict.starts_at, conflict.ends_at)}
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={overrideConflict}
                    onCheckedChange={(checked) => setOverrideConflict(checked === true)}
                  />
                  Book anyway
                </label>
              </AlertDescription>
            </Alert>
          )}

          {bookingType === "external" && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-hirer">Hirer</Label>
                  <Input
                    id="venue-booking-hirer"
                    value={hirerName}
                    onChange={(event) => setHirerName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-email">Email</Label>
                  <Input
                    id="venue-booking-email"
                    type="email"
                    value={hirerEmail}
                    onChange={(event) => setHirerEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-phone">Phone</Label>
                  <Input
                    id="venue-booking-phone"
                    value={hirerPhone}
                    onChange={(event) => setHirerPhone(event.target.value)}
                  />
                </div>
              </div>

              {!booking?.hirer_contact_id && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={saveHirerAsContact}
                    onCheckedChange={(checked) => setSaveHirerAsContact(checked === true)}
                  />
                  Also save this hirer to Service Contacts
                </label>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-fee">Quoted fee</Label>
                  <Input
                    id="venue-booking-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={quotedFee}
                    onChange={(event) => setQuotedFee(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-deposit">Deposit</Label>
                  <Input
                    id="venue-booking-deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-booking-payment">Payment</Label>
                  <Select
                    value={paymentStatus}
                    onValueChange={(value) => setPaymentStatus(value as VenuePaymentStatus)}
                  >
                    <SelectTrigger id="venue-booking-payment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unpaid">Unpaid</SelectItem>
                      <SelectItem value="Deposit paid">Deposit paid</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="venue-booking-notes">Notes</Label>
            <Textarea
              id="venue-booking-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Replace the placeholder bookings page**

Overwrite `src/features/venues/pages/VenuesPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { getVenueBookings, getVenueSpaces } from "@/features/venues/api/venuesApi";
import type { VenueBooking, VenueSpace } from "@/features/venues/lib/venueBookings";
import VenueBookingList from "@/features/venues/components/VenueBookingList";
import VenueBookingModal from "@/features/venues/components/VenueBookingModal";

type StatusFilter = "All" | "Pending" | "Confirmed" | "Cancelled";

const FILTERS: StatusFilter[] = ["All", "Pending", "Confirmed", "Cancelled"];

export default function VenuesPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();

  const [spaces, setSpaces] = useState<VenueSpace[]>([]);
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [editingBooking, setEditingBooking] = useState<VenueBooking | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    if (!workspace?.id) return;
    setLoading(true);

    const [spacesResult, bookingsResult] = await Promise.all([
      getVenueSpaces(workspace.id),
      getVenueBookings({ workspaceId: workspace.id }),
    ]);

    if (spacesResult.error || bookingsResult.error) {
      toast.error("Could not load venue bookings", {
        description: (spacesResult.error || bookingsResult.error)?.message,
      });
    }

    setSpaces((spacesResult.data as VenueSpace[]) || []);
    setBookings((bookingsResult.data as VenueBooking[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [workspace?.id]);

  const pendingCount = useMemo(
    () => bookings.filter((booking) => booking.status === "Pending").length,
    [bookings]
  );

  const visibleBookings = useMemo(
    () => (filter === "All" ? bookings : bookings.filter((booking) => booking.status === filter)),
    [bookings, filter]
  );

  const openNewBooking = () => {
    setEditingBooking(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Venue Hire</h1>
          <p className="text-sm text-muted-foreground">
            Who has the building, and when.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/venues/spaces">Spaces</Link>
          </Button>
          <Button onClick={openNewBooking} disabled={spaces.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            New booking
          </Button>
        </div>
      </div>

      {spaces.length === 0 && !loading ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Add a space first</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Nothing can be booked until the workspace has at least one bookable space.
            </p>
            <Button asChild>
              <Link to="/venues/spaces">Go to Spaces</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={filter === option ? "default" : "outline"}
                onClick={() => setFilter(option)}
              >
                {option}
                {option === "Pending" && pendingCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {pendingCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading bookings…</p>
          ) : (
            <VenueBookingList
              bookings={visibleBookings}
              spaces={spaces}
              onEdit={(booking) => {
                setEditingBooking(booking);
                setModalOpen(true);
              }}
            />
          )}
        </>
      )}

      <VenueBookingModal
        open={modalOpen}
        booking={editingBooking}
        spaces={spaces}
        bookings={bookings}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setModalOpen}
        onSaved={load}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, visit `/venues`.
Check each of these:
1. With no spaces, the "Add a space first" state shows and "New booking" is disabled.
2. Create an internal booking — no money fields appear anywhere in the modal.
3. Create an external booking on the same space at an overlapping time — the red clash banner names the first booking and its status, and saving is refused until "Book anyway" is ticked.
4. Create a booking that starts exactly when another ends — no warning.
5. Tick "Also save this hirer to Service Contacts", save, then check `/people/contacts` for the new "Hirer" contact.
6. The Pending filter chip shows a count badge.

Expected: all six behave as described, no console errors.

- [ ] **Step 5: Typecheck, lint, test, and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm test
git add src/features/venues
git commit -m "feat(venues): add the bookings screen with clash warnings"
```

---

### Task 6: Public request form and link management

**Files:**
- Replace: `src/pages/PublicVenueRequest.tsx` (the Task 4 placeholder)
- Modify: `src/features/venues/pages/VenueSpacesPage.tsx` (add the request-link card)

**Interfaces:**
- Consumes: `getVenueRequestToken`, `setVenueRequestToken` from Task 3; the `get_venue_request_spaces` and `submit_venue_request` RPCs from Task 1.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Build the public request page**

Overwrite `src/pages/PublicVenueRequest.tsx`. It calls the two RPCs directly with the anon client — the page renders outside the authenticated route group, so there is no session.

```tsx
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type RequestSpace = {
  id: string;
  name: string;
  description: string;
  capacity: number | null;
};

const LINK_DEAD = "This request link is no longer active.";

export default function PublicVenueRequest() {
  const { token } = useParams();

  const [spaces, setSpaces] = useState<RequestSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [spaceId, setSpaceId] = useState("");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const loadSpaces = async () => {
      setLoading(true);
      setError("");

      const { data, error: rpcError } = await (supabase as any).rpc("get_venue_request_spaces", {
        request_token: token || "",
      });

      if (rpcError || !data || (data as RequestSpace[]).length === 0) {
        setError(LINK_DEAD);
        setSpaces([]);
      } else {
        setSpaces(data as RequestSpace[]);
        setSpaceId((data as RequestSpace[])[0].id);
      }

      setLoading(false);
    };

    loadSpaces();
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!spaceId || !title.trim() || !name.trim() || !email.trim() || !startsAt || !endsAt) {
      setError("Please fill in the required fields.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("The end time must be after the start time.");
      return;
    }

    setSubmitting(true);

    const { error: rpcError } = await (supabase as any).rpc("submit_venue_request", {
      request_token: token || "",
      target_space_id: spaceId,
      booking_title: title.trim(),
      hirer_name: name.trim(),
      hirer_email: email.trim(),
      hirer_phone: phone.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      request_notes: notes.trim(),
    });

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message || "We could not send your request. Please try again.");
      return;
    }

    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-muted-foreground">{LINK_DEAD}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <h1 className="text-xl font-semibold">Request sent</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thank you. Someone will be in touch to confirm availability and cost.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Request a venue</h1>
        <p className="text-sm text-muted-foreground">
          Send your details and we will confirm availability and cost.
        </p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="request-space">
            Space
          </label>
          <select
            id="request-space"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={spaceId}
            onChange={(event) => setSpaceId(event.target.value)}
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
                {space.capacity ? ` (seats ${space.capacity})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="request-title">
            What is it for?
          </label>
          <Input id="request-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-start">
              From
            </label>
            <Input
              id="request-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-end">
              Until
            </label>
            <Input
              id="request-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-name">
              Your name
            </label>
            <Input id="request-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-email">
              Email
            </label>
            <Input
              id="request-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-phone">
              Phone
            </label>
            <Input id="request-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="request-notes">
            Anything we should know?
          </label>
          <Textarea
            id="request-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Sending…" : "Send request"}
        </Button>
      </form>
    </div>
  );
}
```

Note the form values survive a failed submit — the error renders above the button and nothing is reset.

- [ ] **Step 2: Add the link card to the spaces page**

In `src/features/venues/pages/VenueSpacesPage.tsx`, add these imports:

```tsx
import { getVenueRequestToken, setVenueRequestToken } from "@/features/venues/api/venuesApi";
```

Add state and handlers inside the component, after the existing state:

```tsx
  const [requestToken, setRequestToken] = useState<string | null>(null);

  const loadToken = async () => {
    if (!workspace?.id) return;
    const { data } = await getVenueRequestToken(workspace.id);
    setRequestToken((data as { venue_request_token: string | null })?.venue_request_token ?? null);
  };

  useEffect(() => {
    loadToken();
  }, [workspace?.id]);

  const requestUrl = requestToken ? `${window.location.origin}/venue-request/${requestToken}` : "";

  const toggleRequestLink = async () => {
    if (!workspace?.id) return;
    const nextToken = requestToken ? null : crypto.randomUUID().replace(/-/g, "");
    const { error } = await setVenueRequestToken(workspace.id, nextToken);
    if (error) {
      toast.error("Could not update the request link", { description: error.message });
      return;
    }
    setRequestToken(nextToken);
    toast.success(nextToken ? "Request link created" : "Request link revoked");
  };
```

Then render this card directly below the page header, above the spaces grid:

```tsx
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="font-medium">Public request link</p>
            <p className="text-sm text-muted-foreground">
              {requestToken
                ? "Anyone with this link can send a hire request. Requests arrive as Pending."
                : "Off. Turn it on to let outsiders request a space themselves."}
            </p>
            {requestToken && (
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{requestUrl}</p>
            )}
          </div>
          <div className="flex gap-2">
            {requestToken && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(requestUrl);
                  toast.success("Link copied");
                }}
              >
                Copy link
              </Button>
            )}
            <Button variant={requestToken ? "ghost" : "default"} onClick={toggleRequestLink}>
              {requestToken ? "Revoke link" : "Create link"}
            </Button>
          </div>
        </CardContent>
      </Card>
```

- [ ] **Step 3: Verify the whole public loop in the browser**

Run: `npm run dev`
1. On `/venues/spaces`, click "Create link" and copy the URL.
2. Open that URL in a private window (no session). The form loads and lists only active spaces, with no rates shown anywhere.
3. Submit a request. The thank-you screen appears.
4. Back in the app, `/venues` with the Pending filter shows the request, badged "Request", with no fee.
5. Open it, set it to Confirmed, add a fee, tick "Also save this hirer to Service Contacts", save.
6. Back on `/venues/spaces`, click "Revoke link", then reload the public URL in the private window. Expected: "This request link is no longer active." and no space names.

- [ ] **Step 4: Typecheck, lint, and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
git add src/pages/PublicVenueRequest.tsx src/features/venues/pages/VenueSpacesPage.tsx
git commit -m "feat(venues): add the public hire request form and shareable link"
```

---

### Task 7: Show bookings on the shared calendar

**Files:**
- Modify: `src/pages/CalendarModule.tsx` — `CalendarSource` (line 40), `CalendarEvent.entityType` (line 48), `sourceStyles` (line 88), the `loadCalendar` `Promise.all` and merge (lines 205-269), and `editEvent` (line 338)

**Interfaces:**
- Consumes: `getVenueBookings` from Task 3; `VenueBooking` from Task 2.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Widen the calendar's item types**

In `src/pages/CalendarModule.tsx`, line 40, add `"venue"` to `CalendarSource`:

```tsx
type CalendarSource = "actsix" | "task" | "venue" | "google" | "outlook" | "apple";
```

Line 48, add `"venue"` to the `entityType` union in `CalendarEvent`:

```tsx
  entityType: "event" | "task" | "venue";
```

`sourceStyles` at line 88 is a `Record<CalendarSource, string>`, so TypeScript will now demand a `venue` entry. Add one that matches the visual weight of the neighbouring entries:

```tsx
  venue: "border-amber-200 bg-amber-50 text-amber-900",
```

- [ ] **Step 2: Add venue bookings as a fourth source in the loader**

Import at the top of the file:

```tsx
import { getVenueBookings } from "@/features/venues/api/venuesApi";
import type { VenueBooking } from "@/features/venues/lib/venueBookings";
```

Add the query as a fourth entry in the existing `Promise.all` inside `loadCalendar` (around line 205), destructuring it as `venueResult`:

```tsx
      getVenueBookings({ workspaceId: workspace.id }),
```

Then, after the existing `taskEvents` mapping and before `setEvents(...)`, add:

```tsx
    if (venueResult.error && venueResult.error.code !== "42P01") {
      toast.error(friendlyErrorMessage(venueResult.error));
    }

    // A cancelled hire is not occupying the building, so it never shows here.
    // Pending requests map to Tentative - the calendar's existing word for
    // "someone has asked, nobody has agreed".
    const venueEvents = ((venueResult.data as VenueBooking[]) || [])
      .filter((booking) => booking.status !== "Cancelled")
      .map((booking) => ({
        id: `venue-${booking.id}`,
        entityId: booking.id,
        entityType: "venue" as const,
        title: booking.title,
        calendarName: "Venue Hire",
        source: "venue" as const,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        allDay: false,
        location: "",
        description: booking.notes,
        status: (booking.status === "Pending" ? "Tentative" : "Confirmed") as CalendarStatus,
      }));
```

Change the merge on line 269 to include them:

```tsx
    setEvents([...calendarEvents, ...taskEvents, ...venueEvents]);
```

The `42P01` (undefined table) check mirrors the existing guard above it, so a workspace that has not applied the Task 1 migration sees no error spam.

- [ ] **Step 3: Route clicks on a venue item to the Venue Hire screen**

`editEvent` (around line 338) opens the calendar-event form for anything that is not a task, which would let someone edit a booking as though it were a plain event. Add a branch at the top of that function, beside the existing task branch:

```tsx
  const editEvent = (event: CalendarEvent) => {
    if (event.entityType === "venue") {
      navigate("/venues");
      return;
    }

    if (event.entityType === "task") {
      setEditingTask({ ...event.task });
      return;
    }
```

If `navigate` is not already in scope in this component, add `const navigate = useNavigate();` alongside the other hooks and import `useNavigate` from `react-router-dom`.

The delete button at line 725 is already gated on `event.entityType === "event" && event.source === "actsix"`, so venue items get no delete affordance without any change.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, visit `/calendar`.
Expected: confirmed and pending venue bookings appear on their dates alongside calendar events and tasks, styled with the venue colour; clicking one lands on `/venues` rather than opening the event editor; a booking set to Cancelled on `/venues` disappears from the calendar on reload; no console errors.

- [ ] **Step 5: Typecheck, lint, and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
git add src/pages/CalendarModule.tsx
git commit -m "feat(venues): show venue bookings on the shared calendar"
```

---

### Task 8: Full verification pass

**Files:** none — this task only runs checks and fixes what they surface.

- [ ] **Step 1: Run the full verification suite**

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm test
npm run build
```

Expected: all four clean. Fix anything that fails before continuing — do not proceed with known failures.

- [ ] **Step 2: Walk the edge cases in the browser**

Run `npm run dev` and confirm each:

1. Venue Hire toggled off in Settings hides the sidebar section; `/venues` typed directly still resolves (module toggles control navigation, not routing — this matches every other module).
2. Deleting a space that has bookings fails and offers deactivation instead of an unhandled error.
3. A deactivated space no longer appears in the new-booking space picker, but an existing booking on it still opens and saves.
4. Switching a booking from external to internal and saving clears the fee — reopen it and confirm the money fields are gone and the stored fee is 0.
5. An invalid `/venue-request/<garbage>` URL shows only the dead-link message, with no workspace or space names leaked.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(venues): resolve issues found in the verification pass"
```

Skip this step if nothing needed fixing.
