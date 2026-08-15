# Venue Hire — detail page Overview section

Date: 2026-08-15
Status: Approved

## Problem

`VenueHireDetailPage` opens on the Dates section. That is one of five sections
behind a rail — Dates, Money, Plan, On the day, Afterwards — and everything
else is a click away. A hire carries a lot of state that someone wants at a
glance: what it is worth, whether it has been paid, whether the contract exists,
whether a role is still unfilled, whether anything went wrong on the day. Today
each of those answers costs a rail click, and there is no single screen that
answers "where is this hire up to".

The rail's attention badges hint at trouble, but a number on a tab says only
that something is wrong, not what.

## Goal

A first rail section, **Overview**, that summarises each of the other four
sections in a card and lets someone jump to the section behind it. It becomes
the default landing section for the page.

Explicitly out of scope:

- **Actions on the cards.** No "Record payment" or "Generate contract" button.
  Every action keeps exactly one entry point, in the panel that owns it, so
  there is no second code path to keep working.
- **New data.** Every figure on the Overview is already fetched by the page and
  computed by an existing pure helper. No query, no migration.
- **Reordering by urgency.** The card order is fixed and mirrors the rail, so
  the same card is always in the same place.
- **A module-wide dashboard** across all hires. This is the detail page only.

## Design

### The component

One new file, `src/features/venues/components/VenueHireOverviewPanel.tsx`.

It receives the domain data the page already has in scope and calls the
existing pure helpers itself, in the same way `VenuePaymentsPanel` takes `lines`
and `payments` and calls `paymentSummary`. The page is 752 lines already; the
Overview adds no computation to it.

Props:

| Prop | Type | Used for |
| --- | --- | --- |
| `hire` | `VenueHire` | quote status, contract, debrief |
| `bookings` | `VenueBooking[]` | span, count, spaces |
| `spaces` | `VenueSpace[]` | space names |
| `lines` | `VenueQuoteLine[]` | quote total |
| `payments` | `VenuePayment[]` | paid, outstanding |
| `runSheetItems` | `VenueRunSheetItem[]` | run sheet count |
| `positions` | `VenuePosition[]` | unfilled roles |
| `assignments` | `VenuePositionAssignment[]` | unfilled roles |
| `incidents` | `VenueIncident[]` | open incidents |
| `turnaroundTasks` | `VenueTurnaroundTask[]` | turnaround progress |
| `onSelect` | `(id: VenueHireSectionId) => void` | jump to a section |

Helpers reused, all already unit-tested: `hireSpan`, `paymentSummary`,
`unfilledCount`, `incidentSummary`, `turnaroundProgress`.

### The cards

| Card | Shows | Empty state | Jumps to |
| --- | --- | --- | --- |
| Dates | span and day count, booking count, space names | "Nothing booked yet" | `dates` |
| Money | quote total, quote status, paid / outstanding with a progress bar, whether a contract has been generated | "No quote lines yet" | `money` |
| Plan | run sheet item count, unfilled roles | "Nothing planned yet" | `plan` |
| On the day | open incidents, or "No open incidents" | — | `day` |
| Afterwards | turnaround tasks done of total, whether a debrief has been written | "Nothing recorded yet" | `after` |

Each card is a real `<button>` wrapping a `Card`, so it is reachable by keyboard
and announced as an action rather than as decoration.

Layout is a one-column grid that becomes two columns at `sm`; Afterwards spans
the full width so the grid does not end on a ragged half-row.

Styling uses the existing `Card` primitive and the Studio `--st-*` tokens, the
same as every other panel in the module.

### The rail

`VenueHireSectionId` gains `overview` as its first member, and
`VenueHireDetailPage`'s default section changes from `"dates"` to `"overview"`.

The Overview rail item carries **no** attention badge. The per-section badges
already count what needs doing, and a badge on Overview would light up a second
number for the same underlying problem.

Existing `?section=dates` links keep working — the URL parameter is unchanged
and only the fallback differs.

## Testing

One new test file, `VenueHireOverviewPanel.test.tsx`. Render the panel with a
hire that has an outstanding balance and an unfilled role, assert both figures
appear, and assert that clicking the Money card calls `onSelect` with `"money"`.

The arithmetic behind every figure is already covered by the helpers' own tests,
so the panel's test covers what the panel itself adds: the right numbers reach
the right card, and a card navigates.
