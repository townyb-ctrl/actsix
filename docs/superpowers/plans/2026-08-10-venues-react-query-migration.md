# Venues React Query Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Venues feature's hand-rolled `useEffect`/`useState`/race-token data fetching with `@tanstack/react-query` (`useQuery` for reads, `queryClient.invalidateQueries` for post-mutation refresh), which is already an installed dependency and already wraps the whole app via `QueryClientProvider` in `src/App.tsx` but currently has zero call sites anywhere in the codebase.

**Architecture:** Add one new file, `src/features/venues/api/venuesQueries.ts`, exporting query-key builders and three `useQuery`-backed hooks (`useVenueSpaces`, `useVenueBookings`, `useVenueRequestToken`) that wrap the existing `venuesApi.ts` functions unchanged. Then migrate `VenuesPage.tsx` and `VenueSpacesPage.tsx` to consume those hooks instead of their own `load()`/`useEffect` pairs, and to call `queryClient.invalidateQueries` after a mutation instead of re-calling a manual loader function. `venuesApi.ts` itself, and every presentational component (`VenueCalendar`, `VenueBookingList`, `VenueBookingModal`, `VenueSpaceEditorModal`), are untouched — they already take data via props and stay that way.

**Tech Stack:** React 18, `@tanstack/react-query` v5 (already in `package.json:48`), TypeScript, Vitest + `@testing-library/react` (`renderHook`, `waitFor`), the existing `src/test/supabaseMock.ts` helper.

## Global Constraints

- Do not add any new dependency — `@tanstack/react-query` is already installed and already provides `QueryClientProvider` at the app root (`src/App.tsx:52,68`).
- Do not change `venuesApi.ts` — its exported functions (`getVenueSpaces`, `getVenueBookings`, `getVenueRequestToken`, `upsertVenueSpace`, `setVenueSpaceActive`, `upsertVenueBooking`, `deleteVenueBooking`, `setVenueRequestToken`, `createHirerContact`) keep their exact current signatures; the new hooks call them as-is.
- Do not change any presentational component's props (`VenueCalendar`, `VenueBookingList`, `VenueBookingModal`, `VenueSpaceEditorModal`) — they still receive plain arrays/callbacks, just now sourced from a hook instead of local state.
- Do not touch `VenueBookingModal`'s or `VenueSpaceEditorModal`'s internal `upsert`/`delete`/`createHirerContact` calls or their `saving`/`deleting` local state — converting those to `useMutation` is out of scope for this plan (see Notes at the end).
- Query keys are plain arrays starting with a fixed string tag (`"venue-spaces"`, `"venue-bookings"`, `"venue-request-token"`) so `invalidateQueries({ queryKey: ["venue-bookings"] })` (default `exact: false`) matches every variant of that query regardless of workspace/date-window arguments.
- Every new hook and every migrated page must keep behaving identically from the user's point of view: same loading text, same error toasts, same empty states. This plan changes *how* data arrives, not what the UI shows.

---

## File Structure

- **Create:** `src/features/venues/api/venuesQueries.ts` — query-key builders + `useVenueSpaces`, `useVenueBookings`, `useVenueRequestToken`.
- **Create:** `src/features/venues/api/venuesQueries.test.ts` — tests for the three hooks.
- **Modify:** `src/features/venues/pages/VenuesPage.tsx` — consume `useVenueSpaces` + `useVenueBookings`, drop `loadToken` ref and manual `load()`.
- **Modify:** `src/features/venues/pages/VenueSpacesPage.tsx` — consume `useVenueSpaces` + `useVenueRequestToken`, drop `loadSpaces()`/`loadToken()`.

No other file changes.

---

### Task 1: `useVenueSpaces` hook

**Files:**
- Create: `src/features/venues/api/venuesQueries.ts`
- Create: `src/features/venues/api/venuesQueries.test.ts`

**Interfaces:**
- Consumes: `getVenueSpaces(workspaceId?: string | null)` from `src/features/venues/api/venuesApi.ts:45-50` (returns `Promise<{ data: unknown; error: unknown }>`); `VenueSpace` type from `src/features/venues/lib/venueBookings.ts:6-21`.
- Produces: `venueSpacesKey(workspaceId?: string | null): readonly ["venue-spaces", string | null | undefined]`; `useVenueSpaces(workspaceId?: string | null): { spaces: VenueSpace[]; loading: boolean; error: { message: string } | null; refetch: () => void }`. Later tasks (2, 3, 4, 5) import both from this file.

- [ ] **Step 1: Write the failing test**

Create `src/features/venues/api/venuesQueries.test.ts`:

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { createQueryBuilder, errorResult, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { useVenueSpaces } from "./venuesQueries";

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useVenueSpaces", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads spaces for the given workspace", async () => {
    const space = {
      id: "space-1",
      workspace_id: "workspace-1",
      user_id: "user-1",
      name: "Main Hall",
      description: "",
      capacity: null,
      hourly_rate: 0,
      daily_rate: 0,
      color: "",
      features: [],
      photo_urls: [],
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const builder = createQueryBuilder(okResult([space]));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(() => useVenueSpaces("workspace-1"), { wrapper });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_spaces");
    expect(result.current.spaces).toEqual([space]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces the error and returns an empty array when the query fails", async () => {
    const builder = createQueryBuilder(errorResult("permission denied"));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(() => useVenueSpaces("workspace-1"), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.spaces).toEqual([]);
    expect(result.current.error).toEqual({ message: "permission denied" });
  });

  it("does not query when there is no workspace id", () => {
    const { result } = renderHook(() => useVenueSpaces(undefined), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.spaces).toEqual([]);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/venues/api/venuesQueries.test.ts`
Expected: FAIL — `Cannot find module './venuesQueries'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/features/venues/api/venuesQueries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { getVenueSpaces } from "@/features/venues/api/venuesApi";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";

export const venueSpacesKey = (workspaceId?: string | null) => ["venue-spaces", workspaceId] as const;

export function useVenueSpaces(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: venueSpacesKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getVenueSpaces(workspaceId);
      if (error) throw error;
      return (data as VenueSpace[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    spaces: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
    refetch: query.refetch,
  };
}
```

Note on `loading`: `useQuery`'s `isPending` stays `true` forever when `enabled: false` (no workspace id yet) because the query has literally never run — that's why `fetchStatus !== "idle"` is checked too, so a disabled query reports `loading: false` (matching the "no active workspace yet" case the old code treated as not-loading).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/venues/api/venuesQueries.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/api/venuesQueries.ts src/features/venues/api/venuesQueries.test.ts
git commit -m "feat(venues): add useVenueSpaces react-query hook"
```

---

### Task 2: `useVenueBookings` hook

**Files:**
- Modify: `src/features/venues/api/venuesQueries.ts`
- Modify: `src/features/venues/api/venuesQueries.test.ts`

**Interfaces:**
- Consumes: `getVenueBookings({ workspaceId, fromIso, toIso })` from `src/features/venues/api/venuesApi.ts:76-95`; `VenueBooking` type from `src/features/venues/lib/venueBookings.ts:31-57`.
- Produces: `venueBookingsKey(workspaceId?: string | null, fromIso?: string, toIso?: string): readonly ["venue-bookings", ...]`; `useVenueBookings(args: { workspaceId?: string | null; fromIso?: string; toIso?: string }): { bookings: VenueBooking[]; loading: boolean; error: { message: string } | null }`. Task 4 imports both.

- [ ] **Step 1: Write the failing test**

Append to `src/features/venues/api/venuesQueries.test.ts` (add the import alongside the existing one, and add this `describe` block after the `useVenueSpaces` block):

```ts
import { useVenueBookings, useVenueSpaces } from "./venuesQueries";
```

```ts
describe("useVenueBookings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads bookings for the given workspace and date window", async () => {
    const booking = {
      id: "booking-1",
      workspace_id: "workspace-1",
      user_id: "user-1",
      space_id: "space-1",
      title: "Youth night",
      booking_type: "internal",
      hirer_contact_id: null,
      hirer_name: "",
      hirer_email: "",
      hirer_phone: "",
      starts_at: "2026-08-10T18:00:00.000Z",
      ends_at: "2026-08-10T20:00:00.000Z",
      status: "Confirmed",
      quoted_fee: 0,
      deposit_amount: 0,
      payment_status: "Not applicable",
      source: "staff",
      requested_features: [],
      needs_technician: false,
      technician_fee: 0,
      coffee_requested: false,
      coffee_fee: 0,
      notes: "",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const builder = createQueryBuilder(okResult([booking]));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(
      () => useVenueBookings({ workspaceId: "workspace-1", fromIso: "2026-08-01", toIso: "2026-08-31" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_bookings");
    expect(builder.gte).toHaveBeenCalledWith("starts_at", "2026-08-01");
    expect(builder.lte).toHaveBeenCalledWith("starts_at", "2026-08-31");
    expect(result.current.bookings).toEqual([booking]);
  });

  it("refetches when the date window changes", async () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    const { result, rerender } = renderHook(
      ({ fromIso }: { fromIso: string }) =>
        useVenueBookings({ workspaceId: "workspace-1", fromIso, toIso: "2026-08-31" }),
      { wrapper, initialProps: { fromIso: "2026-08-01" } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);

    rerender({ fromIso: "2026-09-01" });

    await waitFor(() => expect(supabaseMock.from).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/venues/api/venuesQueries.test.ts`
Expected: FAIL — `useVenueBookings` is not exported from `./venuesQueries`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/features/venues/api/venuesQueries.ts` (below `useVenueSpaces`):

```ts
import { getVenueBookings, getVenueSpaces } from "@/features/venues/api/venuesApi";
import type { VenueBooking, VenueSpace } from "@/features/venues/lib/venueBookings";
```

(replace the existing narrower import line with the two-name version above), then add:

```ts
export const venueBookingsKey = (workspaceId?: string | null, fromIso?: string, toIso?: string) =>
  ["venue-bookings", workspaceId, fromIso, toIso] as const;

export function useVenueBookings({
  workspaceId,
  fromIso,
  toIso,
}: {
  workspaceId?: string | null;
  fromIso?: string;
  toIso?: string;
}) {
  const query = useQuery({
    queryKey: venueBookingsKey(workspaceId, fromIso, toIso),
    queryFn: async () => {
      const { data, error } = await getVenueBookings({ workspaceId, fromIso, toIso });
      if (error) throw error;
      return (data as VenueBooking[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    bookings: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/venues/api/venuesQueries.test.ts`
Expected: PASS (all 5 tests: 3 from Task 1, 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/api/venuesQueries.ts src/features/venues/api/venuesQueries.test.ts
git commit -m "feat(venues): add useVenueBookings react-query hook"
```

---

### Task 3: `useVenueRequestToken` hook

**Files:**
- Modify: `src/features/venues/api/venuesQueries.ts`
- Modify: `src/features/venues/api/venuesQueries.test.ts`

**Interfaces:**
- Consumes: `getVenueRequestToken(workspaceId: string)` from `src/features/venues/api/venuesApi.ts:148-153` (returns `{ data: { venue_request_token: string | null } | null; error }`).
- Produces: `venueRequestTokenKey(workspaceId?: string | null): readonly ["venue-request-token", ...]`; `useVenueRequestToken(workspaceId?: string | null): { requestToken: string | null; loading: boolean }`. Task 5 imports both.

- [ ] **Step 1: Write the failing test**

Add import and `describe` block to `src/features/venues/api/venuesQueries.test.ts`:

```ts
import { useVenueBookings, useVenueRequestToken, useVenueSpaces } from "./venuesQueries";
```

```ts
describe("useVenueRequestToken", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when no token has been issued", async () => {
    const builder = createQueryBuilder(okResult({ venue_request_token: null }));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(() => useVenueRequestToken("workspace-1"), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.requestToken).toBeNull();
  });

  it("returns the stored token", async () => {
    const builder = createQueryBuilder(okResult({ venue_request_token: "abc123" }));
    supabaseMock.from.mockReturnValue(builder);

    const { result } = renderHook(() => useVenueRequestToken("workspace-1"), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.requestToken).toBe("abc123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/venues/api/venuesQueries.test.ts`
Expected: FAIL — `useVenueRequestToken` is not exported from `./venuesQueries`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/features/venues/api/venuesQueries.ts`. First widen the `venuesApi` import once more to include `getVenueRequestToken`:

```ts
import { getVenueBookings, getVenueRequestToken, getVenueSpaces } from "@/features/venues/api/venuesApi";
```

Then add:

```ts
export const venueRequestTokenKey = (workspaceId?: string | null) => ["venue-request-token", workspaceId] as const;

export function useVenueRequestToken(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: venueRequestTokenKey(workspaceId),
    queryFn: async () => {
      const { data } = await getVenueRequestToken(workspaceId as string);
      return (data as { venue_request_token: string | null } | null)?.venue_request_token ?? null;
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    requestToken: query.data ?? null,
    loading: query.isPending && query.fetchStatus !== "idle",
  };
}
```

This intentionally drops the `error` from `getVenueRequestToken` (the original `VenueSpacesPage.loadToken` never checked it either — see `src/features/venues/pages/VenueSpacesPage.tsx:46-50` — so this preserves existing behavior exactly rather than introducing a new toast the page never had).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/venues/api/venuesQueries.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/api/venuesQueries.ts src/features/venues/api/venuesQueries.test.ts
git commit -m "feat(venues): add useVenueRequestToken react-query hook"
```

---

### Task 4: Migrate `VenuesPage.tsx`

**Files:**
- Modify: `src/features/venues/pages/VenuesPage.tsx`
- Test: `src/features/venues/components/VenueBookingModal.test.tsx` and `src/features/venues/components/VenueCalendar.test.tsx` (run only — neither imports `VenuesPage`, so neither should need edits; this task's "test" step is confirming that).

**Interfaces:**
- Consumes: `useVenueSpaces` (Task 1), `useVenueBookings` (Task 2), both from `@/features/venues/api/venuesQueries`; `useQueryClient` from `@tanstack/react-query`.
- Produces: nothing new for later tasks — this is a leaf page.

- [ ] **Step 1: Write the failing test**

There is no existing `VenuesPage.test.tsx`, and adding full page-level integration tests is out of this plan's scope (see Notes). Instead, this step is a regression guard: run the two existing component tests that exercise the pieces `VenuesPage` renders, to have a documented green baseline before touching the page.

Run: `npx vitest run src/features/venues/components/VenueBookingModal.test.tsx src/features/venues/components/VenueCalendar.test.tsx`
Expected: PASS (baseline, unrelated to this task's change — confirms the components `VenuesPage` composes are independently healthy before the page itself changes).

- [ ] **Step 2: Confirm the current implementation being replaced**

Current `src/features/venues/pages/VenuesPage.tsx:43-90`:

```tsx
export default function VenuesPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();

  const [spaces, setSpaces] = useState<VenueSpace[]>([]);
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [editingBooking, setEditingBooking] = useState<VenueBooking | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Clicking "next month" repeatedly fires overlapping requests; nothing
  // guarantees they resolve in the order they were sent. Each call stamps
  // its own token and only paints state if it's still the most recent call
  // by the time its response lands, so a slow month+1 response can't land
  // after a fast month+3 response and paint the wrong bookings under the
  // wrong month label.
  const loadToken = useRef(0);

  const load = async () => {
    if (!workspace?.id) return;
    setLoading(true);

    const token = ++loadToken.current;
    const { fromIso, toIso } = queryWindowFor(visibleMonth);

    const [spacesResult, bookingsResult] = await Promise.all([
      getVenueSpaces(workspace.id),
      getVenueBookings({ workspaceId: workspace.id, fromIso, toIso }),
    ]);

    if (token !== loadToken.current) return; // a newer request has already superseded this one

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
  }, [workspace?.id, visibleMonth]);
```

- [ ] **Step 3: Replace with the react-query version**

Replace the block quoted in Step 2 with:

```tsx
export default function VenuesPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<StatusFilter>("All");
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [editingBooking, setEditingBooking] = useState<VenueBooking | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { fromIso, toIso } = queryWindowFor(visibleMonth);

  const { spaces, error: spacesError } = useVenueSpaces(workspace?.id);
  const { bookings, loading, error: bookingsError } = useVenueBookings({
    workspaceId: workspace?.id,
    fromIso,
    toIso,
  });

  useEffect(() => {
    const error = spacesError || bookingsError;
    if (error) {
      toast.error("Could not load venue bookings", { description: error.message });
    }
  }, [spacesError, bookingsError]);

  const refreshBookings = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-bookings"] });
  };
```

Then, further down the same file:

1. Delete the `queryWindowFor` re-derivation — it's already called once above; the JSDoc comment above the original `queryWindowFor` function definition (`src/features/venues/pages/VenuesPage.tsx:24-41`) stays untouched, only the call site moved.
2. Change the `<VenueBookingModal onSaved={load} .../>` prop (currently `src/features/venues/pages/VenuesPage.tsx:211`) to `onSaved={refreshBookings}`.
3. Update the imports at the top of the file: remove `import { getVenueBookings, getVenueSpaces } from "@/features/venues/api/venuesApi";` and `useRef` from the `react` import (no longer used), add:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useVenueBookings, useVenueSpaces } from "@/features/venues/api/venuesQueries";
```

4. `pendingCount`, `visibleBookings`, and `activeSpaceCount` (currently `src/features/venues/pages/VenuesPage.tsx:92-105`) are unchanged — they already just derive from `bookings`/`spaces`, which are now hook return values instead of state, same shape.

- [ ] **Step 4: Run the regression tests again**

Run: `npx vitest run src/features/venues/components/VenueBookingModal.test.tsx src/features/venues/components/VenueCalendar.test.tsx`
Expected: PASS (unchanged — confirms the page migration didn't alter the components' contracts).

Run: `npx tsc --noEmit -p .`
Expected: no errors (confirms `getVenueBookings`/`getVenueSpaces`/`useRef` removal didn't leave a dangling reference, and the new hook return types line up with what the JSX below expects).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/pages/VenuesPage.tsx
git commit -m "refactor(venues): migrate VenuesPage to react-query hooks"
```

---

### Task 5: Migrate `VenueSpacesPage.tsx`

**Files:**
- Modify: `src/features/venues/pages/VenueSpacesPage.tsx`

**Interfaces:**
- Consumes: `useVenueSpaces` (Task 1), `useVenueRequestToken` (Task 3), both from `@/features/venues/api/venuesQueries`; `useQueryClient` from `@tanstack/react-query`.
- Produces: nothing new for later tasks — leaf page.

- [ ] **Step 1: Confirm the current implementation being replaced**

Current `src/features/venues/pages/VenueSpacesPage.tsx:20-54`:

```tsx
export default function VenueSpacesPage() {
  const { user } = useAuth();
  const { workspace, isAdmin } = useCurrentWorkspace();

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
```

- [ ] **Step 2: Replace with the react-query version**

```tsx
export default function VenueSpacesPage() {
  const { user } = useAuth();
  const { workspace, isAdmin } = useCurrentWorkspace();
  const queryClient = useQueryClient();

  const [editingSpace, setEditingSpace] = useState<VenueSpace | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { spaces, loading, error: spacesError } = useVenueSpaces(workspace?.id);
  const { requestToken } = useVenueRequestToken(workspace?.id);

  useEffect(() => {
    if (spacesError) {
      toast.error("Could not load spaces", { description: spacesError.message });
    }
  }, [spacesError]);

  const refreshSpaces = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-spaces"] });
  };

  const requestUrl = requestToken ? `${window.location.origin}/venue-request/${requestToken}` : "";
```

Then, further down the same file:

1. In `toggleRequestLink` (currently `src/features/venues/pages/VenueSpacesPage.tsx:58-74`), replace the direct `setRequestToken(nextToken)` call with `queryClient.invalidateQueries({ queryKey: ["venue-request-token"] })` — the success path currently reads:
   ```tsx
   setRequestToken(nextToken);
   toast.success(nextToken ? "Request link created" : "Request link revoked");
   ```
   becomes:
   ```tsx
   queryClient.invalidateQueries({ queryKey: ["venue-request-token"] });
   toast.success(nextToken ? "Request link created" : "Request link revoked");
   ```
2. In `toggleActive` (currently `src/features/venues/pages/VenueSpacesPage.tsx:76-83`), replace `loadSpaces();` with `refreshSpaces();`.
3. Change the `<VenueSpaceEditorModal onSaved={loadSpaces} .../>` prop (currently `src/features/venues/pages/VenueSpacesPage.tsx:232`) to `onSaved={refreshSpaces}`.
4. Update imports at the top of the file: remove `import { getVenueSpaces, setVenueSpaceActive, getVenueRequestToken, setVenueRequestToken } from "@/features/venues/api/venuesApi";` and replace with:
   ```tsx
   import { useQueryClient } from "@tanstack/react-query";
   import { setVenueSpaceActive, setVenueRequestToken } from "@/features/venues/api/venuesApi";
   import { useVenueRequestToken, useVenueSpaces } from "@/features/venues/api/venuesQueries";
   ```
   (`setVenueSpaceActive` and `setVenueRequestToken` are mutations, still called directly — only the two GET functions move behind hooks.)

- [ ] **Step 3: Run verification**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx vitest run`
Expected: full suite PASS — this also confirms no other file imported `VenueSpacesPage`'s or `VenuesPage`'s now-removed local state in a way this plan didn't anticipate.

- [ ] **Step 4: Commit**

```bash
git add src/features/venues/pages/VenueSpacesPage.tsx
git commit -m "refactor(venues): migrate VenueSpacesPage to react-query hooks"
```

---

### Task 6: Full-suite verification and manual feel-check

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated suite**

```bash
npx tsc --noEmit -p .
npx vitest run
```

Expected: both clean. This is the final gate — every earlier task already ran a scoped version of this, this step catches any cross-file interaction the scoped runs couldn't see.

- [ ] **Step 2: Manual feel-check**

Run `npm run dev`, sign in, and on `/venues`:
- Confirm the calendar and booking list populate on first load (no blank state, no console error).
- Click "next month" several times quickly — confirm the calendar always ends up showing the month you released on (this is the exact race the old `loadToken` ref guarded against; react-query's built-in stale-response handling must reproduce that guarantee).
- Create a booking, confirm it appears in the list and calendar without a manual refresh (proves `refreshBookings`'s `invalidateQueries` call works).
- On `/venues/spaces`: add a space, confirm it appears without a manual refresh; toggle "Create link" / "Revoke link", confirm the URL box appears/disappears without a manual refresh.

- [ ] **Step 3: Commit** (only if Step 2 surfaced a fix — otherwise nothing to commit)

---

## Notes

- **Out of scope, deliberately:** `VenueBookingModal.tsx`'s and `VenueSpaceEditorModal.tsx`'s own `upsertVenueBooking`/`deleteVenueBooking`/`upsertVenueSpace`/`createHirerContact` calls stay plain `async` functions with local `saving`/`deleting` state — not converted to `useMutation`. Converting those is a natural follow-up (it would replace the manual `saving`/`deleting` booleans with `mutation.isPending`), but doing it in this plan would touch two more files with their own existing test coverage (`VenueBookingModal.test.tsx`) for marginal benefit, since `invalidateQueries` after a plain `await` already gets the cache-freshness win. Revisit with a follow-up plan if the `useMutation` ergonomics (built-in `isPending`, automatic rollback support) are wanted later.
- **`retry: false` on all three hooks:** matches the old code's behavior exactly (it never retried a failed Supabase call). React Query's default is 3 retries with backoff; leaving that default in would change user-visible timing (a permission error would take several seconds to surface instead of appearing immediately) without being asked for. If retries are wanted later, that is a one-line change per hook, not a rewrite.
- **No `staleTime` set:** the global `queryClient` in `src/App.tsx:52` (`new QueryClient()`) still has its default `staleTime: 0`, so every remount of `VenuesPage`/`VenueSpacesPage` refetches — the same "always fresh on navigation" behavior the old `useEffect(() => { load() }, [workspace?.id])` pattern had. Tuning `staleTime` for fewer refetches is a deliberate follow-up decision, not a side effect of this migration.
- **This plan is the template for the rest of the app:** 25 other files match the same `setLoading(true)` manual-fetch pattern this plan replaces in Venues (see the codebase performance review earlier in this conversation). Once this plan lands, the same four-step shape (query-key builder → `useQuery` hook → hook test → page migration) is the pattern to repeat per feature.
