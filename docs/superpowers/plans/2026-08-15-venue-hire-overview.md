# Venue Hire Overview Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Overview" section to the venue hire detail page that summarises the other four sections in a grid of clickable cards, and make it the section the page opens on.

**Architecture:** One new presentational component, `VenueHireOverviewPanel`, receives the domain arrays the page already fetches and calls the existing pure helpers (`hireSpan`, `paymentSummary`, `unfilledCount`, `incidentSummary`, `turnaroundProgress`) itself — the same way `VenuePaymentsPanel` takes `lines` and `payments` and calls `paymentSummary`. No new query, no migration, no arithmetic added to the already-752-line page. The rail's `VenueHireSectionId` union gains `overview` as its first member and the page's default section changes from `"dates"` to `"overview"`.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind (with `brand-*` colour tokens from `tailwind.config.ts`), shadcn `Card`/`Badge` primitives, Vitest + `@testing-library/react`, lucide-react icons.

## Global Constraints

- Cards are read-only. No action buttons — no "Record payment", no "Generate contract". Every action keeps exactly one entry point, in the panel that owns it.
- No new data fetching. Every figure comes from props the page already has in scope.
- Card order is fixed and mirrors the rail: Dates, Money, Plan, On the day, Afterwards. No reordering by urgency.
- Each card is a real `<button>` so it is keyboard-reachable and announced as an action.
- Currency is always rendered through `formatCurrency` from `@/features/venues/lib/venueBookings` (en-ZA, ZAR). Never hand-format an amount.
- Test runner is `npx vitest run <path>`. The whole suite is `npm test`.
- The Overview rail item carries **no** attention badge.

---

### Task 1: The Overview panel component

**Files:**
- Create: `src/features/venues/components/VenueHireOverviewPanel.tsx`
- Test: `src/features/venues/components/VenueHireOverviewPanel.test.tsx`

**Interfaces:**
- Consumes: existing types and helpers, all already exported and unit-tested —
  - `VenueHire` from `@/features/venues/lib/venueHires`, and `hireSpan(bookings: VenueBooking[]): HireSpan | null` where `HireSpan = { startsAt: string; endsAt: string; dayCount: number }`
  - `VenueBooking`, `VenueSpace`, `formatCurrency(amount: number): string` from `@/features/venues/lib/venueBookings`
  - `VenueQuoteLine` from `@/features/venues/lib/venueQuotes`
  - `VenuePayment`, `paymentSummary(lines, payments): { charged: number; received: number; outstanding: number; bondHeld: number; isSettled: boolean }` from `@/features/venues/lib/venuePayments`
  - `VenueRunSheetItem` from `@/features/venues/lib/venueRunSheet`
  - `VenuePosition`, `VenuePositionAssignment`, `unfilledCount(position, assignments): number` from `@/features/venues/lib/venuePositions`
  - `VenueIncident`, `incidentSummary(incidents): { total: number; open: number; needsAttention: number }` from `@/features/venues/lib/venueSafety`
  - `VenueTurnaroundTask`, `turnaroundProgress(tasks): { done: number; total: number; allDone: boolean }` from `@/features/venues/lib/venueTurnaround`
  - `VenueHireSectionId` from `@/features/venues/components/VenueHireSectionRail` (currently `"dates" | "money" | "plan" | "day" | "after"`; Task 2 adds `"overview"`)
- Produces: default export `VenueHireOverviewPanel` taking the props object defined in Step 3. Task 2 renders it.

- [ ] **Step 1: Write the failing test**

Create `src/features/venues/components/VenueHireOverviewPanel.test.tsx`. The factories mirror the style already used in `VenueCalendar.test.tsx` — a builder per type, every field filled, `...overrides` last.

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VenueHireOverviewPanel from "./VenueHireOverviewPanel";
import type { VenueBooking, VenueSpace } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";
import type { VenuePayment } from "@/features/venues/lib/venuePayments";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";
import type { VenuePosition, VenuePositionAssignment } from "@/features/venues/lib/venuePositions";
import type { VenueIncident } from "@/features/venues/lib/venueSafety";
import type { VenueTurnaroundTask } from "@/features/venues/lib/venueTurnaround";

const hire = (overrides: Partial<VenueHire> = {}): VenueHire => ({
  id: "hire-1",
  workspace_id: "workspace-1",
  user_id: "user-1",
  name: "Smith Wedding Reception",
  event_type: "Wedding",
  hirer_contact_id: null,
  hirer_name: "Eleanor Smith",
  hirer_email: "eleanor@example.com",
  hirer_phone: "",
  onsite_contact_name: "",
  onsite_contact_phone: "",
  status: "Confirmed",
  quote_status: "Accepted",
  quote_sent_at: null,
  payment_terms: "",
  contract_clauses: "",
  contract_signed_on: null,
  contract_signed_by: "",
  enquiry_id: null,
  lessons_learned: "",
  debrief_notes: "",
  debrief_completed_on: null,
  hirer_rating: null,
  would_host_again: null,
  damage_found: "",
  damage_cost: 0,
  portal_token: null,
  portal_enabled: false,
  security_required: false,
  security_provider: "",
  security_from: null,
  security_to: null,
  car_guards_required: false,
  car_guard_count: 0,
  access_plan: "",
  av_preset_id: null,
  walkie_channels: "",
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const space = (overrides: Partial<VenueSpace> & { id: string }): VenueSpace => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  name: "Main Hall",
  description: "",
  capacity: null,
  hourly_rate: 0,
  daily_rate: 0,
  color: "#0d9488",
  photo_urls: [],
  standing_capacity: null,
  seated_capacity: null,
  floor_plan_url: null,
  hireable_standalone: true,
  setup_minutes: 0,
  packdown_minutes: 0,
  food_allowed: true,
  is_restricted_zone: false,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  hire_id: "hire-1",
  title: "Smith Wedding Reception",
  booking_type: "external",
  hirer_contact_id: null,
  hirer_name: "Eleanor Smith",
  hirer_email: "",
  hirer_phone: "",
  starts_at: "2026-10-14T12:00:00.000Z",
  ends_at: "2026-10-14T21:00:00.000Z",
  status: "Confirmed",
  quoted_fee: 0,
  deposit_amount: 0,
  payment_status: "Unpaid",
  source: "staff",
  requested_features: [],
  needs_technician: false,
  technician_fee: 0,
  coffee_requested: false,
  coffee_fee: 0,
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const line = (overrides: Partial<VenueQuoteLine> & { id: string }): VenueQuoteLine => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  kind: "Space",
  description: "Main Hall hire",
  quantity: 1,
  unit_price: 1200,
  sort_order: 0,
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const payment = (overrides: Partial<VenuePayment> & { id: string }): VenuePayment => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  kind: "Payment",
  amount: 400,
  paid_on: "2026-09-01",
  method: "EFT",
  reference: "",
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const position = (overrides: Partial<VenuePosition> & { id: string }): VenuePosition => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  role_id: "role-1",
  starts_at: "2026-10-14T12:00:00.000Z",
  ends_at: "2026-10-14T21:00:00.000Z",
  needed: 2,
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const baseProps = {
  hire: hire(),
  bookings: [booking({ id: "booking-1" })],
  spaces: [space({ id: "hall" })],
  lines: [line({ id: "line-1" })],
  payments: [payment({ id: "payment-1" })],
  runSheetItems: [] as VenueRunSheetItem[],
  positions: [position({ id: "position-1" })],
  assignments: [] as VenuePositionAssignment[],
  incidents: [] as VenueIncident[],
  turnaroundTasks: [] as VenueTurnaroundTask[],
};

describe("VenueHireOverviewPanel", () => {
  it("shows what is still outstanding and still unfilled", () => {
    render(<VenueHireOverviewPanel {...baseProps} onSelect={vi.fn()} />);

    // 1200 quoted, 400 received, so 800 is still owed.
    expect(screen.getByText("R 800,00")).toBeInTheDocument();
    // One position needing 2 people with nobody assigned.
    expect(screen.getByText(/2 roles unfilled/i)).toBeInTheDocument();
  });

  it("jumps to the section behind a card", () => {
    const onSelect = vi.fn();
    render(<VenueHireOverviewPanel {...baseProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Money/i }));

    expect(onSelect).toHaveBeenCalledWith("money");
  });
});
```

One thing to watch: **the currency string.** `formatCurrency` is `Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" })`, and its exact output for `800` — specifically which space character separates `R` from the digits — depends on the Node ICU build. If `getByText("R 800,00")` does not match, do **not** hand-write a different literal: import `formatCurrency` from `@/features/venues/lib/venueBookings` in the test and assert `screen.getByText(formatCurrency(800))`.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/features/venues/components/VenueHireOverviewPanel.test.tsx`

Expected: FAIL — `Failed to resolve import "./VenueHireOverviewPanel"`.

- [ ] **Step 3: Write the component**

Create `src/features/venues/components/VenueHireOverviewPanel.tsx`:

```tsx
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, type VenueBooking, type VenueSpace } from "@/features/venues/lib/venueBookings";
import { hireSpan, type VenueHire } from "@/features/venues/lib/venueHires";
import { paymentSummary, type VenuePayment } from "@/features/venues/lib/venuePayments";
import { unfilledCount, type VenuePosition, type VenuePositionAssignment } from "@/features/venues/lib/venuePositions";
import { incidentSummary, type VenueIncident } from "@/features/venues/lib/venueSafety";
import { turnaroundProgress, type VenueTurnaroundTask } from "@/features/venues/lib/venueTurnaround";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";
import type { VenueHireSectionId } from "@/features/venues/components/VenueHireSectionRail";

type Props = {
  hire: VenueHire;
  bookings: VenueBooking[];
  spaces: VenueSpace[];
  lines: VenueQuoteLine[];
  payments: VenuePayment[];
  runSheetItems: VenueRunSheetItem[];
  positions: VenuePosition[];
  assignments: VenuePositionAssignment[];
  incidents: VenueIncident[];
  turnaroundTasks: VenueTurnaroundTask[];
  onSelect: (id: VenueHireSectionId) => void;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * One card, and the whole card is the control. A card that is only readable
 * makes somebody hunt back to the rail for the section it just described.
 */
function OverviewCard({
  title,
  section,
  onSelect,
  className,
  children,
}: {
  title: string;
  section: VenueHireSectionId;
  onSelect: (id: VenueHireSectionId) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(section)}
      className={`rounded-xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40 active:scale-[0.995] motion-reduce:active:scale-100 ${
        className ?? ""
      }`}
    >
      <Card className="h-full transition hover:border-brand-teal/40">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent className="space-y-1 text-sm">{children}</CardContent>
      </Card>
    </button>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground">{children}</p>
);

/**
 * Where a hire is up to, one card per rail section.
 *
 * Nothing here is fetched or calculated that the sections do not already know -
 * the helpers below are the same pure functions their panels call. The cards
 * carry no actions on purpose: an action needs exactly one place it happens in,
 * or the two places drift.
 */
export default function VenueHireOverviewPanel({
  hire,
  bookings,
  spaces,
  lines,
  payments,
  runSheetItems,
  positions,
  assignments,
  incidents,
  turnaroundTasks,
  onSelect,
}: Props) {
  const span = hireSpan(bookings);
  const spaceNames = [
    ...new Set(
      bookings
        .map((entry) => spaces.find((room) => room.id === entry.space_id)?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ];

  const money = paymentSummary(lines, payments);
  // Guard the divide: a hire with no quote lines must not render NaN%.
  const paidPercent =
    money.charged > 0 ? Math.min(100, Math.max(0, (money.received / money.charged) * 100)) : 0;
  const overpaid = money.outstanding < 0;

  const unfilled = positions.reduce(
    (short, position) => short + unfilledCount(position, assignments),
    0
  );
  const safety = incidentSummary(incidents);
  const turnaround = turnaroundProgress(turnaroundTasks);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <OverviewCard title="Dates" section="dates" onSelect={onSelect}>
        {span ? (
          <>
            <p className="font-medium">
              {formatDate(span.startsAt)} – {formatDate(span.endsAt)}
            </p>
            <p className="text-muted-foreground">
              {plural(span.dayCount, "day")} · {plural(bookings.length, "booking")}
            </p>
            {spaceNames.length > 0 && <p className="text-muted-foreground">{spaceNames.join(", ")}</p>}
          </>
        ) : (
          <Empty>Nothing booked yet.</Empty>
        )}
      </OverviewCard>

      <OverviewCard title="Money" section="money" onSelect={onSelect}>
        {lines.length === 0 ? (
          <Empty>No quote lines yet.</Empty>
        ) : (
          <>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(money.charged)}</p>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="presentation"
            >
              <div className="h-full rounded-full bg-brand-teal" style={{ width: `${paidPercent}%` }} />
            </div>
            <p className="text-muted-foreground">
              {formatCurrency(money.received)} paid ·{" "}
              {money.isSettled && !overpaid
                ? "settled"
                : overpaid
                  ? `${formatCurrency(Math.abs(money.outstanding))} overpaid`
                  : `${formatCurrency(money.outstanding)} outstanding`}
            </p>
            <p className="text-muted-foreground">
              Quote {hire.quote_status.toLowerCase()} ·{" "}
              {hire.contract_signed_on
                ? "contract signed"
                : hire.contract_clauses
                  ? "contract unsigned"
                  : "no contract yet"}
            </p>
          </>
        )}
      </OverviewCard>

      <OverviewCard title="Plan" section="plan" onSelect={onSelect}>
        {runSheetItems.length === 0 && positions.length === 0 ? (
          <Empty>Nothing planned yet.</Empty>
        ) : (
          <>
            <p>{plural(runSheetItems.length, "run sheet item")}</p>
            <p className={unfilled > 0 ? "font-medium text-brand-danger" : "text-muted-foreground"}>
              {positions.length === 0
                ? "No roles yet"
                : unfilled > 0
                  ? `${plural(unfilled, "role")} unfilled`
                  : "Every role filled"}
            </p>
          </>
        )}
      </OverviewCard>

      <OverviewCard title="On the day" section="day" onSelect={onSelect}>
        {safety.open === 0 ? (
          <p className="text-muted-foreground">
            No open incidents{safety.total > 0 ? ` · ${plural(safety.total, "resolved")}` : ""}.
          </p>
        ) : (
          <>
            <p className="font-medium text-brand-danger">{plural(safety.open, "open incident")}</p>
            {safety.needsAttention > 0 && (
              <p className="text-muted-foreground">
                {safety.needsAttention} serious or worse
              </p>
            )}
          </>
        )}
      </OverviewCard>

      <OverviewCard title="Afterwards" section="after" onSelect={onSelect} className="sm:col-span-2">
        {turnaround.total === 0 && !hire.debrief_completed_on ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <>
            <p>
              {turnaround.total === 0
                ? "No turnaround tasks"
                : `${turnaround.done} of ${turnaround.total} turnaround tasks done`}
            </p>
            <p className="text-muted-foreground">
              {hire.debrief_completed_on ? "Debrief written" : "No debrief yet"}
            </p>
          </>
        )}
      </OverviewCard>
    </div>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/features/venues/components/VenueHireOverviewPanel.test.tsx`

Expected: PASS, 2 tests.

If the outstanding assertion fails on the currency string, apply the currency note from Step 1 (assert `formatCurrency(800)` rather than a literal). If it fails on the *number*, that is a real bug — check that the factory's `line` has `kind: "Space"` and not a held kind such as `"Deposit"`, since deposits are deliberately excluded from `charged`.

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint`
Expected: no new errors from the two new files.

- [ ] **Step 6: Commit**

```bash
git add src/features/venues/components/VenueHireOverviewPanel.tsx src/features/venues/components/VenueHireOverviewPanel.test.tsx
git commit -m "feat(venues): add the hire overview panel"
```

---

### Task 2: Wire Overview into the rail and the page

**Files:**
- Modify: `src/features/venues/components/VenueHireSectionRail.tsx:1` — the `VenueHireSectionId` union
- Modify: `src/features/venues/pages/VenueHireDetailPage.tsx` — import, default section, rail sections, render branch

**Interfaces:**
- Consumes: `VenueHireOverviewPanel` from Task 1, with the exact prop names in its `Props` type — `hire`, `bookings`, `spaces`, `lines`, `payments`, `runSheetItems`, `positions`, `assignments`, `incidents`, `turnaroundTasks`, `onSelect`.
- Produces: `VenueHireSectionId` gains `"overview"`, so anything switching exhaustively on that union must handle it.

- [ ] **Step 1: Widen the section id**

In `src/features/venues/components/VenueHireSectionRail.tsx`, line 1, put `overview` first so the union's order matches the rail's order:

```ts
export type VenueHireSectionId = "overview" | "dates" | "money" | "plan" | "day" | "after";
```

Change nothing else in that file — the rail already renders whatever sections it is handed, and `attention: 0` already hides the badge.

- [ ] **Step 2: Import the panel**

In `src/features/venues/pages/VenueHireDetailPage.tsx`, add the import next to the other panel imports (near the `VenueHireDaysPanel` import at line 56):

```tsx
import VenueHireOverviewPanel from "@/features/venues/components/VenueHireOverviewPanel";
```

- [ ] **Step 3: Land on Overview**

Same file, in the `activeSection` line (currently line 133), change the fallback:

```tsx
const activeSection = (searchParams.get("section") as VenueHireSectionId) || "overview";
```

An existing `?section=dates` link is unaffected — only the fallback changed.

- [ ] **Step 4: Add the rail item**

Same file, at the head of the `railSections` array (currently line 268), before the `dates` entry:

```tsx
    {
      id: "overview" as const,
      name: "Overview",
      // No badge: the four section badges below already count the same problems,
      // and lighting a fifth number for them says nothing new.
      attention: 0,
    },
```

- [ ] **Step 5: Render the panel**

Same file, immediately before the `{activeSection === "dates" && (` branch (currently line 335), add:

```tsx
          {activeSection === "overview" && (
            <VenueHireOverviewPanel
              hire={hire}
              bookings={hireBookings}
              spaces={spaces}
              lines={lines}
              payments={payments}
              runSheetItems={runSheetItems}
              positions={positions}
              assignments={assignments}
              incidents={incidents}
              turnaroundTasks={turnaroundTasks}
              onSelect={selectSection}
            />
          )}
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS. Nothing else asserts on the default section, so no existing test should need editing. If one does fail on `"dates"` being the landing section, update that test to `"overview"` — the change of default is intended.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 8: Check it in the browser**

Run: `npm run dev`, open a hire at `/venues/hires/<id>`.

Confirm, in order:
1. It opens on Overview, with five rail items and no badge on Overview.
2. Each card is reachable by Tab and activates with Enter and with Space.
3. Clicking the Money card switches the pane to Money and the URL becomes `?section=money`.
4. The browser back button returns to Overview. (The rail uses `replace: true`, so back leaves the page rather than stepping between sections — that is existing behaviour, not a regression to fix here.)
5. At a narrow width the grid is one column and Afterwards is not stranded in a half-row.
6. A hire with no bookings and no quote shows the empty lines, not blanks or `R 0,00` everywhere.

- [ ] **Step 9: Commit**

```bash
git add src/features/venues/components/VenueHireSectionRail.tsx src/features/venues/pages/VenueHireDetailPage.tsx
git commit -m "feat(venues): open the hire detail page on an overview"
```

---

## Notes for the reviewer

- The spec's "whether a contract has been generated" is rendered as three states rather than two — signed / unsigned / none — because `VenueHire` distinguishes `contract_signed_on` from `contract_clauses`, and `VenueContractPanel` already badges Signed vs Unsigned. Collapsing them would have made an unsigned contract read as no contract.
- `hireSpan`, `paymentSummary`, `unfilledCount`, `incidentSummary` and `turnaroundProgress` carry their own unit tests. Task 1's test deliberately covers only what the panel adds: the right numbers reach the right card, and a card navigates.
