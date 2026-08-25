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
  ink-3: "#6E6C63"
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

**Adding a color means adding an `--st-*` token, not a literal.** A hex value in a component is a bug unless it is print-only, or a categorical colour stored on a row (see Space colours).

Reusable `.st-*` classes live in the `@layer components` block further down the same file and reference those tokens; a pattern that appears on more than one screen belongs there rather than in a component's utility soup.

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
- **Ink / Ink-2 / Ink-3** (`#1A1A16` / `#55534B` / `#6E6C63`): primary text, secondary, muted. Ink-3 was `#7E7C72` until it was measured: 4.19:1 on panel and 3.74:1 on ground, a fail at every size the app uses it. It carries most of the muted body text in the product, so the token moved rather than the markup.
- **Space colours** (`--st-space-1` … `--st-space-8`): categorical only, for telling one room from another — on the diary's month grid and on the desk strip's 7px bars. Each is dark enough to carry white 10px type (5.7:1 to 8.6:1); the stock Tailwind hues they replaced ran 2.9:1. `--st-space-3` was Clay `#8a4a38` until the strip stood it beside the rose alarm ink at 7px, where the two were the same mark; it is now Umber `#6b4a2f`, unambiguously brown and still clear of 4.5:1 under white type. A room's colour is identity — it says *which room*, never *something is wrong* — and identity must never be mistakable for an alarm. Legacy values, Clay among them, are translated on read in `venueSpaceColors.ts`, so old rows adopt the palette without a migration. The literal hexes there mirror the tokens because a space's colour is stored on the row, not read from CSS at render; change both together.
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

**The Folding Rule.** A panel that carries both a list people read and a form people fill folds the form and leaves the list open. The lid is the same `--st-panel-hi` strip as a plain sub-heading, its label starts on the same line, and it states the answer on the right — "Nothing arranged", "Your standard wording", "Signed 4 Aug · Dana Robertson" — so shutting a block costs no information, only the editing. Built as `<details>` (`VenuePanelSection`, `.venue-disclosure`), because the keyboard, the toggle and find-in-page are then already correct.

The hire detail page carries the same instinct up a level. **The Open-By-Need Rule.** A dense record page orders itself by what still wants a person, not by filing everything behind tabs. Work that needs somebody stays open at full size; everything already in hand becomes one line that states its own answer and expands in place on request — the Folding Rule's discipline, just coarser, running across whole panels instead of inside one. One function (`hireBoard`, in `venueHireBoard.ts`) scores every concern — a status line plus `hot` / `warm` / null attention — so the page can never disagree with itself about what needs a person. It's the same judgement the venue module's desk applies across every hire, so a hire that reads quiet on the desk reads quiet when you open it.

**Panes measure themselves, not the window.** A stack of panels goes two-up on `repeat(auto-fit, minmax(28rem, 1fr))` rather than a viewport breakpoint — the same window gives a very different column depending on whether the app sidebar is open. `auto-fit` so a section holding one panel still spans the width. The hire page's pane moved from a 24rem minimum to 28rem: its root is 15px, so 24rem let three tracks squeeze into 1118px and every panel wrapped its own header — a panel this dense wants close to 34rem of its own before it earns a neighbour.

## States

Every list surface owes four states, and the loading one is not a sentence:

- **Loading**: a skeleton matching the real layout's shape, so nothing reflows when data lands. Shimmer respects `prefers-reduced-motion`.
- **Empty**: quiet, centered, no dashed box.
- **Error**: rose left-rule, plain language, and it must say that the screen is *not* showing real data. A failed query rendering as an empty list is the most dangerous thing this app can do.
- **Populated**: the default.

**The Live Clock Rule.** A surface whose promise is "what is happening now" recomputes from a ticking clock (`useNow`, 30s), never one frozen at mount. A tab left open over midnight is the common case, not the edge one: the desk and the day screen would otherwise go on confidently reporting yesterday, bands and all.

**The Local Day Rule.** A `YYYY-MM-DD` day key is built from local parts (`localDateKey`), never from `toISOString()` on a local midnight. UTC drags it onto the previous date everywhere east of Greenwich — which is how a link to Wednesday opened Tuesday.

**The No-Reshuffle Rule.** A membership decision must not move under the reader. The hire detail page decides once, on arrival, which concerns still want a person and which are settled, and the split only ever grows for the rest of that visit (the `visit` ref in `VenueHireDetailPage.tsx`) — because attention is recomputed from the record on every render, so completing an action can clear a concern's own reason for being open, unmount its panel mid-edit, and silently drop whatever was typed but not yet saved. The one exception: a settled row the reader has expanded on the shelf is never promoted into the stack out from under them.

**The Complete-Board Rule.** A judgement is only as honest as the feeds behind it. The hire page holds every feed the board reads behind one loading guard and refuses to score anything until all of them have landed, because a feed that arrives a beat late reads as an empty list — and the scorer would read that as either a false problem or, worse, false good news. This is the Error state rule above, one step earlier: that rule says a failure must never look like success; this one says an absence must never look like an answer.

## Components

### The strip (`.st-strip`, `.st-strip-day`, `.st-strip-bar`, `.st-strip-gap`, `.st-swatch`)

A fortnight of the building, one column a day, today at the left edge. Occupancy is drawn as bars, not text: at fourteen columns there is no room for a title, and the question the strip answers is "is it free". A `.st-swatch` is the same mark at 10px, keying the roll of names underneath.

Lanes are reserved across the whole window. Every day renders every lane, free ones as a `.st-strip-gap` that takes its height and draws nothing, so a bar keeps its row on every day of the run it belongs to. A bar that began earlier bleeds left by `calc(var(--st-strip-pad) * 2 + 1px)` — a column's own padding twice, plus the divider between them — so a three-day hire reads as one continuous run rather than three loose marks. The bleed is derived from the padding token rather than hard-coded, so changing the padding cannot silently break every run.

**The Whole Column Rule.** The day column is the target; the bar never is. A 7px mark is not something a thumb hits, and wrapping each one in a link collided with the 44px touch floor and stretched every bar into a block on phones.

**The Hatch-Not-Hue Rule.** The church's own diary is hatched (`repeating-linear-gradient`, −45°), never given a colour of its own. Colour in the strip means one thing — which room — and a second meaning would cost it the first.

### The banded run (`.st-band`, `.st-signal`, `.st-signal-mark`, `.st-signal-fact`)

An attention list banded by how soon a thing needs a person, not by what kind of record it is: a heading strip on `--st-panel-hi`, then rows of title, context line, and one mono fact on the right.

`.st-signal` is capped at `max-width: 62rem`. On a wide monitor an unbounded row throws the fact a thousand pixels from the title it belongs to, and the row stops being one thing to read.

Heat is icon *and* ink, never colour alone: a hot row carries a warning mark and a rose mono fact, a warm one carries neither. The mark slot is reserved on every row so every title starts on the same line — a placeholder dot on the quiet rows read as a stray bullet and cost the mark its meaning on the rows that needed it.

### The figure row (`.st-figure`, `.st-figure-label`, `.st-figure-value`)

A label on the left, one mono value on the right, on the same hairline divider as any other row. For panels whose whole content is a short set of standing facts — what is owed, what bond is held, how many enquiries wait, which room a booking holds. `data-tone="rose"` for a number that is a problem, `data-tone="quiet"` for one that is context or simply unavailable.

### The vitals band (`.st-standfirst`)

Everything true about a record regardless of what you came to do, in one row: `repeat(auto-fit, minmax(11rem, 1fr))` inside a plain `.st-panel`. On the hire detail page it replaced four stacked sidebar cards — hire facts, contacts, notes, a clash headline — that cost 18rem of every screen to say six short things a reader usually already half-knows. Phone numbers are live `tel:` links; the reason somebody opens a record while standing in the building is usually that something needs saying out loud.

### The group heading and the settled shelf (`.st-group`, `.st-group-note`, `.st-shelf-row`, `.st-shelf-name`, `.st-shelf-status`, `.st-shelf-mark`, `.st-shelf-body`)

The Open-By-Need Rule's two halves, built as one pair. `.st-group` labels a run of open panels or the settled list beneath them — a plain eyebrow on the left, a mono count on the right — doing the job a tab rail's labels used to do, without the rail. `.st-shelf-row` is one settled concern: a 12rem name, a status that states its own answer, a chevron. Opening a row mounts its real panel into `.st-shelf-body`; closing it unmounts that panel again, so a hire nobody needs to touch never pays for panels nobody opened.

**The No-Second-Box Rule.** An opened row is more of the row, not a container holding a card. `.st-shelf-body` inset its panel by 16px on a `--st-panel-hi` ground at first, which drew a second bordered, rounded, shadowed card inside the first one at a narrower width — a box in a box, and the eye read it as a nested tab strip rather than as an expansion. The mounted panel now gives up its own surface entirely (no border, no radius, no shadow, no background) and its rows land on the same hairlines and the same 16px left edge as the shelf rows above; the rotated chevron is what says the row is open. The panel's head drops its title for the same reason — the row one line above already names the concern and states its answer, so a second heading in a second style is the nesting repeated in type — and the head disappears altogether when the title was all it held. This is coarser than the Folding Rule above: the Folding Rule collapses a form inside one panel, the shelf collapses a whole panel to a line inside the page.

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
