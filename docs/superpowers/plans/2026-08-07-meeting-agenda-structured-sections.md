# Meeting Agenda Structured Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the single-meeting agenda editor hold nested bullets (2 levels), a heading tag/subtitle, and two alternate section layouts (dated list, boxed list), and carry that structure through into the minutes-from-agenda skeleton — matching the richer structure of a real church scrum-meeting agenda (see spec).

**Architecture:** Extend the existing `AgendaSection`/`AgendaPoint` shape in `meetingAgenda.ts` with optional-with-safe-default fields (`tag`, `subtitle`, `layout`, point `date`/`children`) so every agenda already stored in the database parses identically to before. `MeetingAgendaModal.tsx` gets a layout picker and nested-point controls. `meetingMinutes.ts`'s `renderMinutesHtml` gets two new line patterns (sub-point numbering, italic subtitle marker) to style the richer plain-text minutes output.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react for tests, no new dependencies.

## Global Constraints

- Every field added to `AgendaPoint`/`AgendaSection` must have a default that reproduces today's parsed shape and behavior for any agenda already stored in the database — no migration.
- Nesting is capped at exactly one level (`children` on a top-level point; a child never has its own children) — enforced in both the type usage and the editor UI, not just documentation.
- This plan touches only the single-meeting agenda editor (`MeetingAgendaModal.tsx` / `meetingAgenda.ts`). The recurring-meeting "regular agenda" template editor (`RecurringMeetingDetailPage.tsx` / `recurringMeetings.ts`) is explicitly out of scope — it has its own separate, flat types and stays untouched.
- PDF/print export, letterhead, logo upload are out of scope for this plan entirely.
- Follow this codebase's existing test convention: `.ts` lib files get Vitest unit tests (`*.test.ts`), React components get `@testing-library/react` tests (`*.test.tsx`) — see `src/features/projects/components/ProjectAddTaskRow.test.tsx` and `src/components/ui/form-dialog.test.tsx` for the established style (render, `screen`/`fireEvent`, `vi.fn()` for callback props).
- Match existing code style in every file touched: inline Tailwind classes using this app's existing tokens (`fieldControlClass`, `brand-teal`, `rounded-xl`/`rounded-lg`), no new UI library, no new abstraction beyond what's specified below.

---

## Task 1: Extend the agenda data model (types, parse, serialize, clean)

**Files:**
- Modify: `src/features/meetings/lib/meetingAgenda.ts`
- Test: `src/features/meetings/lib/meetingAgenda.test.ts`

**Interfaces:**
- Produces: `AgendaSectionLayout = "list" | "dated" | "boxed"`; `AgendaPoint { id: string; text: string; date: string; children: AgendaPoint[] }`; `AgendaSection { id: string; heading: string; tag: string; subtitle: string; layout: AgendaSectionLayout; points: AgendaPoint[] }`. `makeAgendaPoint()`, `makeAgendaSection()`, `parseAgendaPayload()`, `serializeAgenda()`, `cleanAgendaSections()` — same names/signatures as today, enriched output shape.
- Consumes: nothing from other tasks (this is the base layer everything else builds on).

- [ ] **Step 1: Update the existing round-trip test to expect the enriched default shape**

In `src/features/meetings/lib/meetingAgenda.test.ts`, replace the `"round-trips a v1 JSON payload"` test body:

```ts
  it("round-trips a v1 JSON payload", () => {
    const stored = serializeAgenda(
      [{ id: "a", heading: "Budget", tag: "", subtitle: "", layout: "list", points: [{ id: "p1", text: "Q1", date: "", children: [] }] }],
      ["Jane"]
    );
    const payload = parseAgendaPayload(stored);
    expect(payload.sections).toEqual([
      { id: "a", heading: "Budget", tag: "", subtitle: "", layout: "list", points: [{ id: "p1", text: "Q1", date: "", children: [] }] },
    ]);
    expect(payload.apologies).toEqual(["Jane"]);
  });
```

- [ ] **Step 2: Add new tests for the new fields, run, verify they fail**

Append to the `describe("parseAgendaPayload", ...)` block in the same file:

```ts
  it("parses layout, tag, subtitle, and one level of nested children", () => {
    const stored = JSON.stringify({
      type: "actsix-agenda-v1",
      sections: [
        {
          id: "s1",
          heading: "Office Admin",
          tag: "(Allan)",
          subtitle: "Wins, Challenges, Changes",
          layout: "list",
          points: [
            {
              id: "p1",
              text: "IFBB Venue Hire",
              children: [{ id: "c1", text: "Timings" }],
            },
          ],
        },
      ],
    });

    const payload = parseAgendaPayload(stored);
    const section = payload.sections[0];

    expect(section.tag).toBe("(Allan)");
    expect(section.subtitle).toBe("Wins, Challenges, Changes");
    expect(section.layout).toBe("list");
    expect(section.points[0].children).toEqual([{ id: "c1", text: "Timings", date: "", children: [] }]);
  });

  it("defaults layout to 'list' and drops a grandchild's own children", () => {
    const stored = JSON.stringify({
      type: "actsix-agenda-v1",
      sections: [
        {
          id: "s1",
          heading: "No layout set",
          points: [{ id: "p1", text: "Point", children: [{ id: "c1", text: "Child", children: [{ id: "g1", text: "Grandchild" }] }] }],
        },
      ],
    });

    const payload = parseAgendaPayload(stored);
    expect(payload.sections[0].layout).toBe("list");
    expect(payload.sections[0].points[0].children[0].children).toEqual([]);
  });

  it("rejects an unrecognized layout value and falls back to 'list'", () => {
    const stored = JSON.stringify({
      type: "actsix-agenda-v1",
      sections: [{ id: "s1", heading: "Weird", layout: "grid", points: [] }],
    });

    expect(parseAgendaPayload(stored).sections[0].layout).toBe("list");
  });
```

Append to the `describe("cleanAgendaSections", ...)` block:

```ts
  it("trims tag and subtitle, and drops empty children", () => {
    const cleaned = cleanAgendaSections([
      {
        id: "1",
        heading: "Intro",
        tag: "  (Allan)  ",
        subtitle: "  Wins  ",
        layout: "list",
        points: [{ id: "p1", text: "Point", date: "", children: [{ id: "c1", text: "  ", date: "", children: [] }] }],
      },
    ]);

    expect(cleaned[0].tag).toBe("(Allan)");
    expect(cleaned[0].subtitle).toBe("Wins");
    expect(cleaned[0].points[0].children).toEqual([]);
  });

  it("keeps a point that has children but no text of its own", () => {
    const cleaned = cleanAgendaSections([
      {
        id: "1",
        heading: "Intro",
        tag: "",
        subtitle: "",
        layout: "list",
        points: [{ id: "p1", text: "  ", date: "", children: [{ id: "c1", text: "Child", date: "", children: [] }] }],
      },
    ]);

    expect(cleaned[0].points).toHaveLength(1);
    expect(cleaned[0].points[0].children).toHaveLength(1);
  });
```

Run: `npx vitest run src/features/meetings/lib/meetingAgenda.test.ts`
Expected: FAIL — `tag`/`subtitle`/`layout`/`date`/`children` don't exist on the current type/parse output yet.

- [ ] **Step 3: Update the types and implementation**

In `src/features/meetings/lib/meetingAgenda.ts`, replace the `AgendaPoint`/`AgendaSection` types:

```ts
export type AgendaSectionLayout = "list" | "dated" | "boxed";

export type AgendaPoint = {
  id: string;
  text: string;
  /** Only meaningful when the owning section's layout is "dated". */
  date: string;
  /** One level only - a child point's own `children` is always kept empty,
   *  enforced here in parsing and by the editor UI not offering the control. */
  children: AgendaPoint[];
};

export type AgendaSection = {
  id: string;
  heading: string;
  /** Short tag rendered beside the heading, e.g. "(Allan)". Empty when unused. */
  tag: string;
  /** Italic line rendered under the heading. Empty when unused. */
  subtitle: string;
  /** Defaults to "list" - absent on every agenda stored before this field existed. */
  layout: AgendaSectionLayout;
  points: AgendaPoint[];
};
```

Replace `makeAgendaPoint` and `makeAgendaSection`:

```ts
export const makeAgendaPoint = (): AgendaPoint => ({
  id: crypto.randomUUID(),
  text: "",
  date: "",
  children: [],
});

export const makeAgendaSection = (): AgendaSection => ({
  id: crypto.randomUUID(),
  heading: "",
  tag: "",
  subtitle: "",
  layout: "list",
  points: [makeAgendaPoint()],
});
```

Add a module-level constant and two parse helpers just above `parseAgendaPayload`:

```ts
const AGENDA_SECTION_LAYOUTS: AgendaSectionLayout[] = ["list", "dated", "boxed"];

const parseAgendaChildPoint = (child: any): AgendaPoint => ({
  id: child?.id || crypto.randomUUID(),
  text: typeof child === "string" ? child : child?.text || "",
  date: typeof child?.date === "string" ? child.date : "",
  // A child's own children are always dropped - nesting is capped at one level.
  children: [],
});

const parseAgendaPoint = (point: any): AgendaPoint => ({
  id: point?.id || crypto.randomUUID(),
  text: typeof point === "string" ? point : point?.text || "",
  date: typeof point?.date === "string" ? point.date : "",
  children:
    typeof point === "object" && Array.isArray(point?.children)
      ? point.children.map(parseAgendaChildPoint)
      : [],
});

const parseAgendaSection = (section: any): AgendaSection => ({
  id: section.id || crypto.randomUUID(),
  heading: section.heading || "",
  tag: typeof section.tag === "string" ? section.tag : "",
  subtitle: typeof section.subtitle === "string" ? section.subtitle : "",
  layout: AGENDA_SECTION_LAYOUTS.includes(section.layout) ? section.layout : "list",
  points:
    Array.isArray(section.points) && section.points.length
      ? section.points.map(parseAgendaPoint)
      : [makeAgendaPoint()],
});
```

In `parseAgendaPayload`, replace the inline `sections.map((section: any) => ({...}))` block (the one that builds `id`/`heading`/`points`) with:

```ts
        sections: parsed.sections.length
          ? parsed.sections.map(parseAgendaSection)
          : [makeAgendaSection()],
```

Replace `serializeAgenda`:

```ts
export const serializeAgenda = (
  sections: AgendaSection[],
  apologies: string[],
  seriesMeta?: AgendaSeriesMeta
) =>
  JSON.stringify({
    type: "actsix-agenda-v1",
    sections: sections.map((section) => ({
      id: section.id,
      heading: section.heading,
      tag: section.tag,
      subtitle: section.subtitle,
      layout: section.layout,
      points: section.points.map((point) => ({
        id: point.id,
        text: point.text,
        date: point.date,
        children: point.children.map((child) => ({
          id: child.id,
          text: child.text,
          date: child.date,
          children: [],
        })),
      })),
    })),
    apologies: cleanNameList(apologies),
    ...(seriesMeta?.recurringSeriesId ? { recurringSeriesId: seriesMeta.recurringSeriesId } : {}),
    ...(seriesMeta?.peopleGroupId ? { peopleGroupId: seriesMeta.peopleGroupId } : {}),
    ...(seriesMeta?.peopleGroupName ? { peopleGroupName: seriesMeta.peopleGroupName } : {}),
  });
```

Replace `cleanAgendaSections`:

```ts
export const cleanAgendaSections = (sections: AgendaSection[]) => {
  const cleaned = sections
    .map((section) => ({
      ...section,
      heading: section.heading.trim(),
      tag: section.tag.trim(),
      subtitle: section.subtitle.trim(),
      points: section.points
        .map((point) => ({
          ...point,
          text: point.text.trim(),
          children: point.children
            .map((child) => ({ ...child, text: child.text.trim() }))
            .filter((child) => child.text),
        }))
        .filter((point) => point.text || point.children.length),
    }))
    .filter((section) => section.heading || section.points.length);

  return cleaned.length ? cleaned : [makeAgendaSection()];
};
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/features/meetings/lib/meetingAgenda.test.ts`
Expected: PASS — all tests in the file, old and new.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors from `meetingAgenda.ts` or its test file. (Errors from `MeetingAgendaModal.tsx`/`MeetingDetailPage.tsx` are expected here — they're still using the old shape and get fixed in later tasks. Confirm any errors reported are confined to those two files.)

- [ ] **Step 6: Commit**

```bash
git add src/features/meetings/lib/meetingAgenda.ts src/features/meetings/lib/meetingAgenda.test.ts
git commit -m "feat: extend agenda data model with layout, tag, subtitle, nested points

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Extend minutes-from-agenda generation

**Files:**
- Modify: `src/features/meetings/lib/meetingAgenda.ts`
- Test: `src/features/meetings/lib/meetingAgenda.test.ts`

**Interfaces:**
- Consumes: `AgendaSection`/`AgendaPoint` from Task 1 (`tag`, `subtitle`, `layout`, point `date`/`children`).
- Produces: `generateMinutesFromAgenda(sections: AgendaSection[]): string` — same signature, richer output. Plain-text conventions later tasks depend on: a section heading line is `"N. TITLE"` (optionally followed by a space and the section's `tag`), an italic subtitle line (when present) is `"_text_"` on its own line right after the heading, a two-level point line is `"N.N text"`, a three-level child line is `"N.N.N text"`, a dated/boxed point line is `"• text"` (optionally ` — date` for dated).

- [ ] **Step 1: Add failing tests for the new generation behavior**

Append to the `describe("generateMinutesFromAgenda", ...)` block in `meetingAgenda.test.ts`:

```ts
  it("numbers a nested child one level deeper than its parent point", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "Office Admin",
        tag: "",
        subtitle: "",
        layout: "list",
        points: [
          {
            id: "p1",
            text: "IFBB Venue Hire",
            date: "",
            children: [{ id: "c1", text: "Timings", date: "", children: [] }],
          },
        ],
      },
    ]);

    expect(out).toContain("1.1 IFBB Venue Hire");
    expect(out).toContain("1.1.1 Timings");
  });

  it("appends the section tag after the heading and renders the subtitle in italics markup", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "Word Of Encouragement",
        tag: "(Allan)",
        subtitle: "Wins, Challenges, Changes",
        layout: "list",
        points: [],
      },
    ]);

    expect(out).toContain("1. WORD OF ENCOURAGEMENT (Allan)");
    expect(out).toContain("_Wins, Challenges, Changes_");
  });

  it("renders a dated-layout section as bullet + date, with no Notes/Decisions blanks", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "What's Next",
        tag: "",
        subtitle: "",
        layout: "dated",
        points: [{ id: "p1", text: "Link Ladies", date: "2026-08-06", children: [] }],
      },
    ]);

    expect(out).toContain("Link Ladies");
    expect(out).not.toContain("Notes:");
    expect(out).not.toContain("1.1");
  });

  it("renders a boxed-layout section as a plain bullet list, with no Notes/Decisions blanks", () => {
    const out = generateMinutesFromAgenda([
      {
        id: "1",
        heading: "Announcers List",
        tag: "",
        subtitle: "",
        layout: "boxed",
        points: [{ id: "p1", text: "Sam vH", date: "", children: [] }],
      },
    ]);

    expect(out).toContain("Sam vH");
    expect(out).not.toContain("Notes:");
  });
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npx vitest run src/features/meetings/lib/meetingAgenda.test.ts`
Expected: the 4 new tests FAIL, existing tests still PASS (current implementation ignores `tag`/`subtitle`/`layout`/`children` entirely).

- [ ] **Step 3: Replace `generateMinutesFromAgenda`**

```ts
export const generateMinutesFromAgenda = (sections: AgendaSection[]) => {
  const cleanSections = sections
    .map((section) => ({
      ...section,
      heading: section.heading.trim(),
      tag: (section.tag || "").trim(),
      subtitle: (section.subtitle || "").trim(),
      points: section.points
        .map((point) => ({
          ...point,
          text: point.text.trim(),
          children: (point.children || [])
            .map((child) => ({ ...child, text: child.text.trim() }))
            .filter((child) => child.text),
        }))
        .filter((point) => point.text || point.children.length),
    }))
    .filter((section) => section.heading || section.points.length);

  if (!cleanSections.length) return "";

  return cleanSections
    .map((section, sectionIndex) => {
      const sectionNumber = sectionIndex + 1;
      const title = (section.heading || "Untitled Section").toUpperCase();
      const titleLine = `${sectionNumber}. ${title}${section.tag ? ` ${section.tag}` : ""}`;
      const subtitleLine = section.subtitle ? `_${section.subtitle}_` : "";

      let pointsBlock = "";

      if (section.layout === "dated") {
        pointsBlock = section.points
          .map((point) => `• ${point.text}${point.date ? ` — ${formatDate(point.date)}` : ""}`)
          .join("\n");
      } else if (section.layout === "boxed") {
        pointsBlock = section.points.map((point) => `• ${point.text}`).join("\n");
      } else {
        pointsBlock = section.points
          .map((point, pointIndex) => {
            const pointNumber = pointIndex + 1;
            const pointLine = `${sectionNumber}.${pointNumber} ${point.text}\nNotes:\nDecisions:`;
            const childLines = point.children
              .map(
                (child, childIndex) =>
                  `${sectionNumber}.${pointNumber}.${childIndex + 1} ${child.text}\nNotes:\nDecisions:`
              )
              .join("\n\n");

            return childLines ? `${pointLine}\n\n${childLines}` : pointLine;
          })
          .join("\n\n");
      }

      return [titleLine, subtitleLine, pointsBlock].filter(Boolean).join("\n");
    })
    .join("\n\n");
};
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run src/features/meetings/lib/meetingAgenda.test.ts`
Expected: PASS — every test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/lib/meetingAgenda.ts src/features/meetings/lib/meetingAgenda.test.ts
git commit -m "feat: carry nested points, tag, subtitle, and section layout into minutes generation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Style sub-points and subtitles in the rendered minutes

**Files:**
- Modify: `src/features/meetings/lib/meetingMinutes.ts`
- Modify: `src/features/meetings/components/MeetingMinutesEditor.tsx`
- Test: `src/features/meetings/lib/meetingMinutes.test.ts`

**Interfaces:**
- Consumes: the plain-text line conventions Task 2 produces (`"N.N.N text"` for a child line, `"_text_"` for a subtitle line).
- Produces: `renderMinutesHtml` unchanged signature; now emits `<div class="minutes-agenda-subpoint">` for a three-level line and `<div class="minutes-subtitle">` for an underscore-wrapped line, in addition to the classes it already emits.

- [ ] **Step 1: Add failing tests**

Append to the `describe("renderMinutesHtml", ...)` block in `meetingMinutes.test.ts`:

```ts
  it("styles a three-level line as a sub-point, distinct from a two-level point", () => {
    const out = renderMinutesHtml("1. OFFICE ADMIN\n1.1 IFBB Venue Hire\n1.1.1 Timings");
    expect(out).toContain('class="minutes-agenda-point"');
    expect(out).toContain('class="minutes-agenda-subpoint"');
  });

  it("renders an underscore-wrapped line as an italic subtitle, without the underscores", () => {
    const out = renderMinutesHtml("1. WEEKEND FEEDBACK\n_Wins, Challenges, Changes_");
    expect(out).toContain('class="minutes-subtitle"');
    expect(out).toContain("Wins, Challenges, Changes");
    expect(out).not.toContain("_Wins");
  });
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/features/meetings/lib/meetingMinutes.test.ts`
Expected: FAIL — neither class exists in the current output; a `"1.1.1 ..."` line currently falls through to a plain `<div>`, and `"_Wins..._"` renders unchanged inside a plain `<div>`.

- [ ] **Step 3: Update `renderMinutesHtml`**

In `src/features/meetings/lib/meetingMinutes.ts`, replace the body of the `.map((line) => { ... })` callback inside `renderMinutesHtml`:

```ts
    .map((line) => {
      const escaped = escapeHtml(line);

      if (/^\d+\.\s+/.test(line)) {
        return `<div class="minutes-section-heading">${escaped.toUpperCase()}</div>`;
      }

      const subtitleMatch = line.match(/^_(.+)_$/);
      if (subtitleMatch) {
        return `<div class="minutes-subtitle">${escapeHtml(subtitleMatch[1])}</div>`;
      }

      if (/^\d+\.\d+\.\d+\s+/.test(line)) {
        return `<div class="minutes-agenda-subpoint">${escaped}</div>`;
      }

      if (/^\d+\.\d+\s+/.test(line)) {
        return `<div class="minutes-agenda-point">${escaped}</div>`;
      }

      if (line.trim() === "") {
        return `<div class="minutes-blank-line"><br /></div>`;
      }

      return `<div>${escaped}</div>`;
    })
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/features/meetings/lib/meetingMinutes.test.ts`
Expected: PASS — every test in the file.

- [ ] **Step 5: Add the two new CSS rules**

In `src/features/meetings/components/MeetingMinutesEditor.tsx`, inside the `<style>{...}</style>` block, immediately after the existing `.minutes-agenda-point` rule, add:

```css
        .minutes-agenda-subpoint {
          margin-top: 0.35rem;
          margin-bottom: 0.1rem;
          margin-left: 1.25rem;
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .minutes-subtitle {
          margin-top: 0.1rem;
          margin-bottom: 0.35rem;
          font-style: italic;
          color: hsl(var(--muted-foreground));
        }
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors from `meetingMinutes.ts` or `MeetingMinutesEditor.tsx`.

Run: `npx eslint src/features/meetings/lib/meetingMinutes.ts src/features/meetings/components/MeetingMinutesEditor.tsx`
Expected: no new errors (pre-existing warnings elsewhere in the file, if any, are fine).

- [ ] **Step 7: Commit**

```bash
git add src/features/meetings/lib/meetingMinutes.ts src/features/meetings/lib/meetingMinutes.test.ts src/features/meetings/components/MeetingMinutesEditor.tsx
git commit -m "feat: style nested sub-points and italic subtitles in rendered minutes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Agenda editor UI — layout picker, tag/subtitle, nested points

**Files:**
- Modify: `src/features/meetings/components/MeetingAgendaModal.tsx`
- Test: `src/features/meetings/components/MeetingAgendaModal.test.tsx` (new)

**Interfaces:**
- Consumes: `AgendaSection`, `AgendaPoint`, `AgendaSectionLayout`, `makeAgendaPoint`, `makeAgendaSection` from Task 1. `MeetingAgendaModalProps` unchanged (`open`, `onOpenChange`, `draft`, `onChange`, `onSave`, `minutesAtRisk?`) — `onChange` still takes `(sections: AgendaSection[]) => AgendaSection[]`.
- Produces: no new exports beyond the existing `MeetingAgendaModal` component and its existing `MeetingAgendaModalProps` type.

- [ ] **Step 1: Write the failing component tests**

Create `src/features/meetings/components/MeetingAgendaModal.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MeetingAgendaModal } from "./MeetingAgendaModal";
import { makeAgendaSection, type AgendaSection } from "@/features/meetings/lib/meetingAgenda";

const baseSection = (overrides: Partial<AgendaSection> = {}): AgendaSection => ({
  ...makeAgendaSection(),
  id: "s1",
  heading: "Week Ahead",
  ...overrides,
});

describe("MeetingAgendaModal", () => {
  it("switching a section's layout to Dated calls onChange with that layout applied", () => {
    const onChange = vi.fn();
    const draft = [baseSection({ points: [{ id: "p1", text: "Link Ladies", date: "", children: [] }] })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Dated" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0](draft);
    expect(result[0].layout).toBe("dated");
  });

  it("a Dated-layout section shows a date input per point and no sub-point control", () => {
    const draft = [baseSection({ layout: "dated", points: [{ id: "p1", text: "Link Ladies", date: "", children: [] }] })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={() => {}} onSave={() => {}} />);

    expect(screen.getByLabelText(/point 1 date/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add sub-point/i })).not.toBeInTheDocument();
  });

  it("adding a sub-point on a List-layout section nests a child under that point", () => {
    const onChange = vi.fn();
    const draft = [baseSection({ points: [{ id: "p1", text: "Office Admin", date: "", children: [] }] })];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Add sub-point/i }));

    const result = onChange.mock.calls[0][0](draft);
    expect(result[0].points[0].children).toHaveLength(1);
  });

  it("typing a tag calls onChange with the tag applied to that section", () => {
    const onChange = vi.fn();
    const draft = [baseSection()];

    render(<MeetingAgendaModal open draft={draft} onOpenChange={() => {}} onChange={onChange} onSave={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Tag \(optional\)/), { target: { value: "(Allan)" } });

    const result = onChange.mock.calls[0][0](draft);
    expect(result[0].tag).toBe("(Allan)");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/features/meetings/components/MeetingAgendaModal.test.tsx`
Expected: FAIL — no "Dated" button, no tag input, no sub-point control exist yet.

- [ ] **Step 3: Rewrite `MeetingAgendaModal.tsx`**

Replace the full file content:

```tsx
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fieldControlClass } from "@/components/ui/field";
import {
  makeAgendaPoint,
  makeAgendaSection,
  type AgendaPoint,
  type AgendaSection,
  type AgendaSectionLayout,
} from "@/features/meetings/lib/meetingAgenda";

export type MeetingAgendaModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AgendaSection[];
  onChange: (updater: (sections: AgendaSection[]) => AgendaSection[]) => void;
  onSave: () => void;
  /** True when the meeting already has written minutes that a refill would replace. */
  minutesAtRisk?: boolean;
};

const LAYOUT_OPTIONS: { value: AgendaSectionLayout; label: string }[] = [
  { value: "list", label: "List" },
  { value: "dated", label: "Dated" },
  { value: "boxed", label: "Boxed" },
];

/** Swaps one section in place, by id. */
const updateSection = (
  sections: AgendaSection[],
  sectionId: string,
  patch: Partial<AgendaSection> | ((section: AgendaSection) => AgendaSection)
) =>
  sections.map((section) =>
    section.id === sectionId ? (typeof patch === "function" ? patch(section) : { ...section, ...patch }) : section
  );

/** Swaps one point in place, by id - used for both a section's top-level
 *  points and (given a point's own `children`) its child list. */
const updatePoint = (
  points: AgendaPoint[],
  pointId: string,
  patch: Partial<AgendaPoint> | ((point: AgendaPoint) => AgendaPoint)
) =>
  points.map((point) =>
    point.id === pointId ? (typeof patch === "function" ? patch(point) : { ...point, ...patch }) : point
  );

export function MeetingAgendaModal({
  open,
  onOpenChange,
  draft,
  onChange,
  onSave,
  minutesAtRisk = false,
}: MeetingAgendaModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="actsix-panel max-h-[86vh] max-w-3xl overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>Edit Agenda</DialogTitle>
          <DialogDescription>
            {minutesAtRisk
              ? "Build the agenda here. Your existing minutes stay exactly as they are — we'll ask first if you want to replace them."
              : "Build the agenda here. Saving will also fill the Minutes section with an outline to write into."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {draft.map((section, sectionIndex) => (
            <Card key={section.id} className="actsix-panel-soft p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-sm font-extrabold text-brand-teal">
                  {sectionIndex + 1}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={section.heading}
                      onChange={(event) =>
                        onChange((sections) => updateSection(sections, section.id, { heading: event.target.value }))
                      }
                      placeholder="Section heading..."
                      aria-label={`Section ${sectionIndex + 1} heading`}
                      className={`font-semibold ${fieldControlClass}`}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove section ${sectionIndex + 1}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        onChange((sections) =>
                          sections.length > 1 ? sections.filter((item) => item.id !== section.id) : [makeAgendaSection()]
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 rounded-full border border-border/70 p-0.5">
                      {LAYOUT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={section.layout === option.value}
                          className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                            section.layout === option.value
                              ? "bg-brand-teal/10 text-brand-teal"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() =>
                            onChange((sections) => updateSection(sections, section.id, { layout: option.value }))
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <Input
                      value={section.tag}
                      onChange={(event) =>
                        onChange((sections) => updateSection(sections, section.id, { tag: event.target.value }))
                      }
                      placeholder="Tag (optional), e.g. (Allan)"
                      aria-label={`Section ${sectionIndex + 1} tag`}
                      className={`h-8 max-w-[10rem] text-xs ${fieldControlClass}`}
                    />

                    <Input
                      value={section.subtitle}
                      onChange={(event) =>
                        onChange((sections) => updateSection(sections, section.id, { subtitle: event.target.value }))
                      }
                      placeholder="Subtitle (optional)"
                      aria-label={`Section ${sectionIndex + 1} subtitle`}
                      className={`h-8 max-w-[14rem] text-xs italic ${fieldControlClass}`}
                    />
                  </div>

                  <div className="space-y-2">
                    {section.points.map((point, pointIndex) => (
                      <div key={point.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-10 shrink-0 text-xs font-bold text-muted-foreground">
                            {sectionIndex + 1}.{pointIndex + 1}
                          </div>

                          <Input
                            value={point.text}
                            onChange={(event) =>
                              onChange((sections) =>
                                updateSection(sections, section.id, (item) => ({
                                  ...item,
                                  points: updatePoint(item.points, point.id, { text: event.target.value }),
                                }))
                              )
                            }
                            placeholder="Agenda point..."
                            aria-label={`Section ${sectionIndex + 1}, point ${pointIndex + 1}`}
                            className={fieldControlClass}
                          />

                          {section.layout === "dated" && (
                            <Input
                              type="date"
                              value={point.date}
                              onChange={(event) =>
                                onChange((sections) =>
                                  updateSection(sections, section.id, (item) => ({
                                    ...item,
                                    points: updatePoint(item.points, point.id, { date: event.target.value }),
                                  }))
                                )
                              }
                              aria-label={`Section ${sectionIndex + 1}, point ${pointIndex + 1} date`}
                              className={`w-40 shrink-0 ${fieldControlClass}`}
                            />
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove point ${sectionIndex + 1}.${pointIndex + 1}`}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              onChange((sections) =>
                                updateSection(sections, section.id, (item) => ({
                                  ...item,
                                  points:
                                    item.points.length > 1
                                      ? item.points.filter((agendaPoint) => agendaPoint.id !== point.id)
                                      : [makeAgendaPoint()],
                                }))
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {section.layout === "list" && (
                          <div className="ml-12 space-y-1.5">
                            {point.children.map((child, childIndex) => (
                              <div key={child.id} className="flex items-center gap-2">
                                <div className="w-14 shrink-0 text-xs font-bold text-muted-foreground">
                                  {sectionIndex + 1}.{pointIndex + 1}.{childIndex + 1}
                                </div>

                                <Input
                                  value={child.text}
                                  onChange={(event) =>
                                    onChange((sections) =>
                                      updateSection(sections, section.id, (item) => ({
                                        ...item,
                                        points: updatePoint(item.points, point.id, (parent) => ({
                                          ...parent,
                                          children: updatePoint(parent.children, child.id, { text: event.target.value }),
                                        })),
                                      }))
                                    )
                                  }
                                  placeholder="Sub-point..."
                                  aria-label={`Section ${sectionIndex + 1}, point ${pointIndex + 1}, sub-point ${childIndex + 1}`}
                                  className={`h-8 text-sm ${fieldControlClass}`}
                                />

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Remove sub-point ${sectionIndex + 1}.${pointIndex + 1}.${childIndex + 1}`}
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    onChange((sections) =>
                                      updateSection(sections, section.id, (item) => ({
                                        ...item,
                                        points: updatePoint(item.points, point.id, (parent) => ({
                                          ...parent,
                                          children: parent.children.filter((c) => c.id !== child.id),
                                        })),
                                      }))
                                    )
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-lg text-xs text-muted-foreground hover:text-brand-teal"
                              onClick={() =>
                                onChange((sections) =>
                                  updateSection(sections, section.id, (item) => ({
                                    ...item,
                                    points: updatePoint(item.points, point.id, (parent) => ({
                                      ...parent,
                                      children: [...parent.children, makeAgendaPoint()],
                                    })),
                                  }))
                                )
                              }
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add sub-point
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-brand-teal hover:text-brand-teal"
                    onClick={() =>
                      onChange((sections) =>
                        updateSection(sections, section.id, (item) => ({
                          ...item,
                          points: [...item.points, makeAgendaPoint()],
                        }))
                      )
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add agenda point
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onChange((sections) => [...sections, makeAgendaSection()])}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
          <Button type="button" className="actsix-btn-primary min-h-10 rounded-xl" onClick={onSave}>
            Save Agenda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/features/meetings/components/MeetingAgendaModal.test.tsx`
Expected: PASS — all 4 tests.

- [ ] **Step 5: Fix every other caller now that the type shape changed**

Run: `npx tsc --noEmit -p tsconfig.json`

This surfaces every place still constructing an `AgendaSection`/`AgendaPoint` with the old flat shape (from Task 1's Step 5, this should be confined to `MeetingDetailPage.tsx` and possibly `RecurringMeetingsPage.tsx`/`RecurringMeetingDetailPage.tsx` if they share the type — confirm with the grep below first).

Run: `grep -rn "makeAgendaSection\|makeAgendaPoint\|AgendaSection\b" src/features/meetings/pages/MeetingDetailPage.tsx`

`MeetingDetailPage.tsx` uses `makeAgendaSection()` (already produces the full new shape from Task 1 — no change needed there) and passes `agendaSections`/`agendaDraft` straight through to `MeetingAgendaModal` and `generateMinutesFromAgenda` without constructing section/point literals inline — so no changes should be needed in `MeetingDetailPage.tsx` itself. If `tsc` reports otherwise, fix the reported literal to include the new fields (`tag: "", subtitle: "", layout: "list"` on a section; `date: "", children: []` on a point) rather than making the new fields optional again.

Expected after fixes: zero TypeScript errors project-wide.

- [ ] **Step 6: Lint and run the design detector**

Run: `npx eslint src/features/meetings/components/MeetingAgendaModal.tsx src/features/meetings/components/MeetingAgendaModal.test.tsx`
Expected: no new errors.

Run: `node .claude/skills/impeccable/scripts/detect.mjs --json src/features/meetings/components/MeetingAgendaModal.tsx` (use `node /Users/brandontownsend/.claude/skills/impeccable/scripts/detect.mjs --json ...` if the project-relative path isn't found)
Expected: `[]`

- [ ] **Step 7: Run the full meetings test suite as a regression check**

Run: `npx vitest run src/features/meetings`
Expected: PASS — every test file under `src/features/meetings`, old and new.

- [ ] **Step 8: Commit**

```bash
git add src/features/meetings/components/MeetingAgendaModal.tsx src/features/meetings/components/MeetingAgendaModal.test.tsx
git commit -m "feat: add layout picker, tag/subtitle, and nested sub-points to the agenda editor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Spec ambiguity resolved during planning:** the spec's Editor UI section mentions a boxed section "renders wrapped in a bordered card in the preview/minutes." The more detailed Rendering section only specifies a plain bullet list with no Notes/Decisions blanks for boxed sections, with no box treatment — because `renderMinutesHtml` works line-by-line with no section-boundary awareness, and giving it one just to draw a box around plain text is out of proportion to what this plan needs. This plan implements the more detailed version: **no visual box in the minutes output**, box styling stays a possible future addition once there's a real export surface to justify it. The editor itself doesn't visually box a boxed-layout section's card either — the layout picker's own selection state is enough feedback.
- Do not touch `src/features/meetings/lib/recurringMeetings.ts`, `RecurringMeetingDetailPage.tsx`, or `RecurringMeetingsPage.tsx` — confirmed out of scope.
