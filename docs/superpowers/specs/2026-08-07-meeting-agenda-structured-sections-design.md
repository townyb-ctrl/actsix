# Meeting agenda/minutes: structured sections

Date: 2026-08-07
Status: Approved

## Problem

Today's meeting agenda is flat: a section is a heading plus one level of bullet
points (`AgendaSection { heading, points: AgendaPoint[] }`, in
`src/features/meetings/lib/meetingAgenda.ts`). A real-world agenda a church
runs on (see the reference PDF, "Linkway Weekly Scrum Meeting") is richer:

- Bullets nest — a top-level item ("Office Admin") has sub-items ("IFBB Venue
  Hire"), which themselves sometimes carry a parenthetical detail.
- A heading can carry a name tag ("WORD OF ENCOURAGEMENT (Allan)") and an
  italic subtitle line ("Wins, Challenges, Changes").
- Some sections are really a dated list ("WHAT'S NEXT": item + date, not a
  discussion point).
- Some sections are a reference list set apart from the discussion flow (an
  "ANNOUNCERS LIST" box).

The agenda editor has no way to represent any of this today, so a leader
either mangles it into flat bullet text or keeps it outside the app entirely.

## Goal

Extend the agenda editor (`MeetingAgendaModal.tsx`) and the agenda data model
to support this structure, and carry it through into the minutes-from-agenda
skeleton the same way today's flat agenda already does.

**Explicitly out of scope:** PDF/print export, a letterhead or logo, page
layout (columns, boxes floated beside content). This project only touches the
in-app editor and the minutes text it seeds — not how a meeting might one day
be exported as a formatted document. That's a separate future project.

## Data model

Extend the existing shape in `meetingAgenda.ts`. Every new field is optional
with a default that reproduces today's behavior exactly, so every agenda
already stored in the database parses identically to before this change.

```ts
export type AgendaPoint = {
  id: string;
  text: string;
  /** Only meaningful when the owning section's layout is "dated". */
  date?: string;
  /** One level only. A child point never has its own children — the editor
   *  UI enforces this by not offering an "add sub-point" control on a child
   *  row, not just the type. */
  children?: AgendaPoint[];
};

export type AgendaSection = {
  id: string;
  heading: string;
  /** Short tag rendered beside the heading, e.g. "(Allan)". */
  tag?: string;
  /** Italic line rendered under the heading, e.g. "Wins, Challenges, Changes". */
  subtitle?: string;
  /** Defaults to "list" - absent on every agenda stored before this change. */
  layout?: "list" | "dated" | "boxed";
  points: AgendaPoint[];
};
```

Layout meanings:

- **`list`** (default): today's bullets, plus a point may hold one level of
  `children`, rendered as indented sub-bullets.
- **`dated`**: points render as two columns (text, date), no bullet marker,
  no children control. Matches "WHAT'S NEXT".
- **`boxed`**: points render as a plain list inside a bordered callout card,
  no dates, no children. Matches "ANNOUNCERS LIST".

`AgendaPayload`, `parseAgendaPayload`, and `serializeAgenda` all extend to
carry `tag`/`subtitle`/`layout` and point `date`/`children` through,
defaulting absent fields exactly as described above.

## Editor UI (`MeetingAgendaModal.tsx`)

Per section, in addition to today's heading + points:

- A three-way layout picker (List / Dated / Boxed), defaulting to List. Only
  changes what's below it — an empty Tag/Subtitle/no-children section on
  "List" layout looks pixel-identical to today's editor.
- **Tag** and **Subtitle**: two optional text inputs under the heading,
  collapsed/empty by default (not two more mandatory fields on every
  section).
- **List layout**: existing point rows unchanged, plus a small "+ sub-point"
  control under each point that appends one nested `children` row (indented,
  smaller text). A child row has no further nesting control.
- **Dated layout**: each point row becomes a text input and a date input side
  by side, replacing the bullet marker and any nesting control.
- **Boxed layout**: same row style as List, no nesting control. The section
  itself renders wrapped in a bordered card, both in the editor and wherever
  else it's previewed.

## Minutes generation (`generateMinutesFromAgenda`, `renderMinutesHtml`)

Carries the new structure through into the same fill-in-the-blank skeleton
minutes already use, rather than a separate code path per layout:

- **List sections**: `3. HEADING`, `3.1 point`, `3.1.1 sub-point` — a child
  point gets one extra numbering level. Every point (parent or child) still
  gets blank `Notes:` / `Decisions:` lines under it, exactly as today.
- **Dated sections**: `3. HEADING` then `• point — date` per point. No
  Notes/Decisions blanks — a dated list is a reference list, not a discussion
  point to minute.
- **Boxed sections**: `3. HEADING` then a plain indented list of points. No
  Notes/Decisions blanks, same reasoning as dated sections.
- `tag` appends after the heading text (`3. WORD OF ENCOURAGEMENT (Allan)`).
  `subtitle` renders as its own italic line directly under the heading line,
  before the first point.

## Compatibility

- `parseAgendaPayload` treats a missing `layout` as `"list"`, missing
  `tag`/`subtitle` as absent, missing point `date`/`children` as absent. No
  migration needed — every agenda already in the database round-trips
  unchanged.
- `cleanAgendaSections` extends to also trim/drop empty `children` the same
  way it already trims/drops empty top-level points.

## Explicitly deferred

- PDF/print export, letterhead, logo upload, page/column layout — a future
  project, once there's an export surface to actually use a logo on.
- Unlimited nesting depth — capped at one level of children, enforced in the
  editor UI as well as the type.
- Drag-reorder for nested points — reuses whatever reorder affordance (if
  any) top-level points already have; not a new capability.
