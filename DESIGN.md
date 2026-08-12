---
name: ACTSIX
description: Ministry-operations platform — an instrument for people running a church week, not a document about one.
colors:
  studio-teal: "#123F3C"
  studio-teal-hi: "#0C2B29"
  studio-teal-dim: "#2C7169"
  rail: "#123F3C"
  ground: "#F4F2ED"
  panel: "#FFFFFF"
  panel-hi: "#FAF8F4"
  line: "#DED9CF"
  line-soft: "#ECEAE3"
  line-strong: "#C6C0B3"
  ink: "#1A1A16"
  ink-2: "#55534B"
  ink-3: "#7E7C72"
  track: "#E7E3DA"
  amber: "#9A6410"
  rose: "#A8402F"
  green: "#3F7A46"
typography:
  heading:
    fontFamily: "Satoshi, Inter Tight, General Sans, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.022em"
  body:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "0.17em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
rounded:
  control: "8px"
  panel: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.studio-teal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    height: "36px (44px on mobile)"
  panel:
    backgroundColor: "{colors.panel}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.panel}"
    shadow: "0 1px 2px rgba(26,26,22,0.04)"
  row:
    divider: "1px solid {colors.line-soft}"
    padding: "11px 16px"
    minHeight: "44px"
---

# Design System: ACTSIX — Studio

## Overview

**Creative North Star: "The Instrument"**

ACTSIX is a tool someone operates while three other things demand their attention. It is scanned, not read. Structure comes from hairline rules and honest alignment rather than from boxes stacked on boxes; depth comes from a single step of elevation, not from shadow. Warmth stays — the ground is warm paper, never a cold grey or a hard white — but the interface behaves like an instrument panel: every number in the same column, every row the same shape, every state legible at a glance.

This replaced the earlier "Quiet Workroom" parchment system in August 2026. Three directions were prototyped and compared before Studio was chosen; the other two (Paper Editorial, Ops Console) were rejected as too airy and too cold respectively.

**Key characteristics:**
- Warm paper ground with pure-white panels lifting one step above it
- One accent — deep teal — appearing about three times per screen
- Borders instead of shadows; the single whisper shadow exists only because white-on-paper needs it
- Every number monospaced with tabular figures
- Rows run edge to edge on hairline dividers, never as separated cards
- State is signalled by color *and* a second cue (a tick, a weight, a position)

## Architecture

Tokens live on `:root` in `src/index.css` under the `--st-*` prefix. That is the source of truth. The app's older HSL tokens (`--background`, `--primary`, `--brand-teal`, `--border`, …) are re-pointed at Studio values in the same block, which is what lets every shadcn primitive, every `.actsix-*` class, and every Radix portal adopt the palette without markup changes.

**Adding a color means adding an `--st-*` token, not a literal.** A hex value in a component is a bug unless it is print-only.

The pre-Studio parchment token block and the old `.dark` block were deleted in the same sweep — they were dead weight that made `index.css` look like it defined two palettes. Everything above the Studio block is now structural only: fonts, radii, spacing, transitions, z-index.

A dark build is a sibling token block away — the token layer was structured for two themes from the start, and only the light build is currently defined.

## Colors

- **Studio Teal** (`#123F3C`): the only "act here / you are here" color, and the same color as the sidebar rail. Roughly 11:1 on panel and ground.
- **Teal Hi** (`#0C2B29`): pressed/hover state for teal surfaces. Never a second accent.
- **Teal Dim** (`#2C7169`): meter fills and quiet accent edges only.
- **Ground** (`#F4F2ED`): the page canvas. Warm, never white.
- **Sidebar** (`#123F3C`): the same deep teal as the accent, painted flat across the one dark surface in the app. The rail is where the brand color is stated at full size; every button, link and active state elsewhere repeats it. White pills mark position on it; shadows there are `rgba(0,0,0,0.16–0.18)`, since a paper shadow does nothing against a dark ground.
- **Panel** (`#FFFFFF`): raised surfaces. White signals elevation, not "default".
- **Panel Hi** (`#FAF8F4`): row hover.
- **Line / Line Soft / Line Strong** (`#DED9CF` / `#ECEAE3` / `#C6C0B3`): panel borders, row dividers, hover borders — in that order of strength.
- **Ink / Ink-2 / Ink-3** (`#1A1A16` / `#55534B` / `#7E7C72`): primary text, secondary, muted.
- **Amber** (`#9A6410`) / **Rose** (`#A8402F`) / **Green** (`#3F7A46`): due today, overdue/destructive, complete. Status meaning only — never decorative.

**The One-Teal Rule.** Studio originally ran a lighter teal on paper and a deeper one on the rail. Two teals meant every element had to ask which surface it sat on, and half of them answered wrong. There is now one brand teal — `#123F3C`, the rail — used for buttons, links, active pills, focus rings, meters, everything on ground or panel.

The single exception is teal that sits *on* the rail itself, where the brand teal is invisible against its own background:

- **`--brand-teal-bright` `#5EBFB2`** — teal on the dark rail (the online dot, tour highlights). Unreadable on white; never use it on paper.

On the rail, position is marked by a white pill, not by teal.

**The Three-Teal Rule.** If teal appears more than about three times on one screen, it has stopped meaning anything. Current location, the primary action, and today — that is the budget.

**The Warm Ground Rule.** The canvas is warm paper. Pure white is a raised surface, and a cold grey is never correct.

## Typography

Display is Satoshi at 700 with −0.022em tracking; body is Manrope; numbers are JetBrains Mono with `font-variant-numeric: tabular-nums`. Labels are 10px, 700, uppercase, 0.17em tracking.

**The Tabular Rule.** Any number that appears in a list, a column, or beside another number is monospaced. Counts, dates, durations, percentages, times. Proportional digits make a scannable column jitter.

**The Weight-Not-Size Rule** (carried over): build hierarchy with weight before reaching for size.

## Layout & density

Rows are 44px minimum, 11px/16px padding, divided by `--st-line-soft` and running the full panel width — the list card carries no inner padding of its own. Panel headers are a 10px uppercase label on the left and a mono tally on the right.

`PageHeader` owns the rule under every page title and the space on both sides of it (`.st-page-head`); pages do not re-invent that gap.

## States

Every list surface owes four states, and the loading one is not a sentence:

- **Loading**: a skeleton matching the real layout's shape, so nothing reflows when data lands. Shimmer respects `prefers-reduced-motion`.
- **Empty**: quiet, centered, no dashed box.
- **Error**: rose left-rule, plain language, and it must say that the screen is *not* showing real data. A failed query rendering as an empty list is the most dangerous thing this app can do.
- **Populated**: the default.

## Do's and Don'ts

### Do
- Add an `--st-*` token rather than a literal color.
- Let rows run edge to edge on dividers; reserve cards for things that genuinely need elevation.
- Monospace every number that sits in a column.
- Pair state color with a second signal.
- Suppress default metadata (`General` context, `Medium` priority, a 15-minute estimate nobody set) — it repeats on every row and carries no information.

### Don't
- Don't introduce a second accent. Amber, rose and green are status; sage, sand and bronze are categorical and stay subordinate.
- Don't stack shadows, or use a shadow where a border will do.
- Don't signal state by color alone.
- Don't write a loading state as a line of text.
- Don't style a wrapper element that only exists for positioning — check whether the visible control is the child before adding a border to it.
