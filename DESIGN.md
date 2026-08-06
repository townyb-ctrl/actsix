---
name: ACTSIX
description: Ministry-operations platform — a quiet, well-organized workroom so administration never outshines the ministry it supports.
colors:
  sacristy-teal: "#2D8C8C"
  sacristy-teal-deep: "#1F6868"
  sacristy-teal-soft: "#E3F0EF"
  quiet-sage: "#7A8F7B"
  quiet-sage-soft: "#E9EEE7"
  warm-sand: "#D8C7A6"
  worn-bronze: "#A67C52"
  parchment: "#F3EFE7"
  card-white: "#FFFFFF"
  parchment-soft: "#EDE8DD"
  ink-charcoal: "#1E1E1B"
  text-secondary: "#4E514B"
  text-muted: "#6F736A"
  border-light: "#D8D0C1"
  border-medium: "#C9BEAD"
  success: "#6F8B6B"
  warning: "#C69245"
  danger: "#B94A3A"
typography:
  heading:
    fontFamily: "Satoshi, Inter Tight, General Sans, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 800
    letterSpacing: "0"
  body:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "0.16em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "14px"
  2xl: "16px"
  control: "0.75rem"
  panel: "1rem"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.sacristy-teal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.sacristy-teal-deep}"
    textColor: "#FFFFFF"
  button-soft:
    backgroundColor: "{colors.sacristy-teal-soft}"
    textColor: "{colors.sacristy-teal-deep}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-charcoal}"
    rounded: "{rounded.panel}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
---

# Design System: ACTSIX

## Overview

**Creative North Star: "The Quiet Workroom"**

ACTSIX looks like a well-kept workroom behind a sanctuary: warm parchment surfaces, one confident accent, and tools put back exactly where they belong. Nothing performs for its own sake — the interface exists to get administrative weight off a leader's shoulders so attention returns to people and the Word. Density stays moderate: enough information to act on at a glance, never a wall of chrome. Warmth comes from parchment neutrals and soft teal, not from saturation or decoration; restraint is the brand.

The system explicitly rejects two extremes: cold enterprise-admin density (Salesforce/SAP/Jira greys-and-grids) and consumer-app flash (gradients, loud motion, competing accent colors). Every screen should pass the "Thursday-afternoon test" — calmer, not busier, for someone juggling three ministry responsibilities at once.

**Key Characteristics:**
- Warm parchment neutrals as the base, not white-and-grey
- One accent color (teal) carries all primary meaning; everything else is neutral or semantic
- Soft, whisper-level shadows — structural hints, never decoration
- Generous, consistent radii (control: 12px, panel: 16px) — nothing sharp-cornered
- Heavy-weight (800) heading type against a calm, regular-weight body — hierarchy through weight, not size alone
- Motion is small and quiet: 1px hover lifts, 120–160ms transitions, never bouncy

## Colors

Warm, low-saturation parchment neutrals carry the interface; teal is the only color allowed to mean "act here."

### Primary
- **Sacristy Teal** (`#2D8C8C` / `hsl(180 51% 36%)`): primary actions, active nav state, links, focus rings, selection state. The one color permitted to say "this is the important thing."
- **Sacristy Teal Deep** (`#1F6868` / `hsl(180 54% 26%)`): hover/active state for teal surfaces — never a second accent, only teal's own pressed state.
- **Sacristy Teal Soft** (`#E3F0EF` / `hsl(175 30% 92%)`): tinted backgrounds for soft buttons, active pills, and teal-adjacent chips where full-strength teal would be too loud.

### Secondary
- **Quiet Sage** (`#7A8F7B` / `hsl(123 9% 52%)`): a second, deliberately quieter categorical color — used for status/category tags (project categories, follow-up states, calendar categories) that need to be distinct from teal without competing with it.
- **Quiet Sage Soft** (`#E9EEE7`): tinted background for sage-tagged chips and badges.

### Tertiary
- **Warm Sand** (`#D8C7A6`) and **Worn Bronze** (`#A67C52`): the remaining categorical palette, reserved for tag/category systems (project types, event categories) that need more than two distinguishable hues. Never used for primary actions.

### Neutral
- **Parchment** (`#F3EFE7`): default page background. This is ACTSIX's "white" — never switch the base canvas to true white.
- **Card White** (`#FFFFFF`): surface color for cards and raised panels, read against parchment.
- **Parchment Soft** (`#EDE8DD`): secondary/nested surface, subtle recesses, mobile background.
- **Ink Charcoal** (`#1E1E1B`): primary text, dark-surface backgrounds (sidebar).
- **Text Secondary** (`#4E514B`) / **Text Muted** (`#6F736A`): body copy de-emphasis and helper text, in that order of fade.
- **Border Light** (`#D8D0C1`) / **Border Medium** (`#C9BEAD`): hairline dividers and input borders, drawn at low opacity against border tokens (`border-border/70`), not as full-strength lines.

### Semantic
- **Success** (`#6F8B6B`), **Warning** (`#C69245`), **Danger** (`#B94A3A`): status meaning only — task completion, overdue states, destructive actions. Never repurposed as decorative accents.

### Named Rules
**The One Accent Rule.** Sacristy Teal is the only color that means "primary action" or "you are here." If two elements on a screen use full-strength teal to mean two different things, one of them is wrong.

**The Never-White Rule.** The base canvas is Parchment, not pure white. Pure white (`Card White`) is reserved for raised surfaces sitting on top of parchment — it signals elevation, not "default background."

## Typography

**Display/Heading Font:** Satoshi (with Inter Tight, General Sans, Manrope fallbacks)
**Body Font:** Manrope (with Inter fallback)
**Mono Font:** JetBrains Mono

**Character:** A heavy, confident heading face over a calm, humanist body face — hierarchy is carried by weight contrast (800 vs 400–600), not by dramatic size jumps or letter-spacing tricks. Headings sit at `letter-spacing: 0`; labels alone earn wide tracking.

### Hierarchy
- **Heading (h1)** (800, scales with viewport via root `font-size` breakpoints, tight line-height): page titles.
- **Heading (h2/h3)** (700): section and card titles.
- **Body** (400–500, 14–16px, 1.5 line-height): default reading and UI copy.
- **Label** (700, 10–12px, `0.16em` uppercase tracking): eyebrows, filter-pill text, nav item labels — always uppercase, always wide-tracked, never used for body copy.
- **Mono** (JetBrains Mono, 400–500): counts, IDs, code-like values only.

### Named Rules
**The Weight-Not-Size Rule.** Prefer a heavier font-weight step over a larger font-size step when building hierarchy in dense UI (dashboards, list rows) — it holds density without shrinking touch targets or overflowing narrow columns.

## Layout

Density is moderate-comfortable: `.actsix-page-body` gives 16–40px horizontal padding scaling by breakpoint (`px-4` mobile → `xl:px-8`/`2xl:px-10` desktop) with a `pb-12` floor so content never crowds the viewport edge. Vertical rhythm between page sections is `space-y-4` (`.actsix-page-stack`) — tight enough to read as one connected workspace, not stacked cards with dead air.

Root font-size steps down for laptop-range viewports (`15px` at 1024–1440px, `17px` at 1441–2200px) and mobile (`15px` ≤767px, `14.5px` ≤390px) — a deliberate density compensation so the same component spacing reads right at every screen size, rather than relying on responsive variants of every component.

Mobile carries its own minimums: 44px minimum touch height on interactive controls, 16px input font-size (prevents iOS auto-zoom), transparent tap-highlight. These are non-negotiable floors, not suggestions.

## Elevation & Depth

Elevation is real but understated: a layered hierarchy exists (flat inline elements → soft card shadow → firmer panel/overlay shadow) and each step should read as an intentional step up, not just a barely-visible haze. Even the top step stays soft — opacity tops out under 10% — because ACTSIX's calm comes from restraint, not from erasing depth entirely.

### Shadow Vocabulary
- **sm** (`0 1px 3px rgba(30,30,27,0.045)`): resting inline elements, subtle separation only.
- **md** (`0 6px 16px rgba(30,30,27,0.065)`): default card/panel elevation.
- **lg** (`0 12px 28px rgba(30,30,27,0.09)`): overlays, modals, popovers — the top of the stack.
- **card** (`0 1px 0 rgba(207,198,181,0.55), 0 4px 14px rgba(30,30,27,0.045)`): the signature card treatment — a hairline top highlight plus a soft drop, giving cards a lifted-off-parchment feel without a hard shadow edge.
- **soft** (`0 1px 6px rgba(30,30,27,0.035)`): the barely-there variant for elements that need to feel present but not raised (search fields, toolbars).

### Named Rules
**The Whisper Rule.** No shadow in this system exceeds ~10% opacity. If a shadow reads as a hard drop rather than a soft lift, it's too strong for ACTSIX.

### Z-Index Scale

Radix/shadcn primitives (dialog, sheet, dropdown-menu, popover) already own Tailwind's default `z-40`/`z-50`. Custom-built overlays use these tokens instead of one-off numbers:

- **`--z-dropdown` (40)**: in-page custom dropdowns/comboboxes while open.
- **`--z-dropdown-panel` (45)**: the open panel content of a custom dropdown, one tier above its trigger.
- **`--z-popover` (50)**: page-level floating UI — user menu, notification popover, feedback bubble.
- **`--z-toast` (60)**: toast notifications — above dialogs so a confirmation fired from inside a modal stays visible.
- **`--z-skip-link` (70)**: the keyboard-only skip-to-content link.
- **`--z-tour` (80)**: the guided tour overlay — intentionally the top of the stack.

**Never introduce a new arbitrary `z-[N]`.** Add a tier to this scale instead.

## Shapes

Radii are consistently generous and layered by role, never sharp: `--radius-control` (0.75rem/12px) for interactive controls (buttons, inputs, segmented controls), `--radius-panel` (1rem/16px) for cards and containers, `--radius-pill` (999px) for chips, filter pills, and badges. A secondary numeric scale (`sm` 6px → `2xl` 16px) exists for shadcn primitives layered underneath the semantic scale. Borders are always drawn at reduced opacity against the border token (`border-border/70`, `border-brand-teal/25`) rather than full-strength — a hairline suggestion of an edge, not a hard rule.

## Components

### Buttons
- **Shape:** `--radius-control` (12px), never sharp corners.
- **Primary:** solid Sacristy Teal, white text, `40px` height (`44px`+ tap target on mobile), soft teal-tinted shadow (`0 4px 12px rgba(45,140,140,0.24)`).
- **Soft:** Sacristy Teal Soft background, Sacristy Teal Deep text, thin teal-tinted border — the default for secondary emphasis actions that shouldn't compete with a primary button on the same screen.
- **Outline:** transparent-leaning teal-tinted background with a teal-tinted border — for tertiary actions.
- **Hover/Focus:** all variants lift 1px (`translateY(-1px)`) and darken toward Sacristy Teal Deep on hover; focus uses a 2px ring at `ring-offset-2`. Compact button variants (inline with filter pills) drop the lift, keeping small dense rows still.

### Chips / Filter Pills
- **Style:** fully rounded (pill), thin border, transparent-to-tinted background by state.
- **Idle:** transparent background, muted-foreground text, low-opacity border.
- **Active:** teal-tinted background (`bg-brand-teal/5`), teal border and text — the same "one accent" language as buttons, scaled down.
- **Counts:** a nested pill-within-pill at 9–10px, inverted fill on active state.

### Cards / Containers
- **Corner Style:** `--radius-panel` (16px), with a slightly tighter radius (`radius-panel - 0.125rem`–`0.25rem`) for nested interactive tiles/rows so they read as "inside" the outer card.
- **Background:** Card White on Parchment.
- **Shadow Strategy:** the `card` shadow token by default (hairline highlight + soft drop); `shadow-none` variants exist for toolbars/tab bars that need a border-only treatment to avoid shadow stacking.
- **Border:** `border-border/70` — always present, always soft.
- **Internal Padding:** `p-5` (20px) header/content, `space-y-1.5` between header lines.

### Inputs / Fields
- **Style:** `--radius-control`, `border-border/70`, `bg-background`, `h-8` default — the density every form field, popup editor, and inline row uses app-wide (set by the Next Actions / Task Editor forms, the reference for the whole system).
- **Text:** `text-base` on mobile (prevents iOS auto-zoom) stepping down to `text-xs` at `sm:` — never a plain `text-sm` field.
- **Label:** `.label-eyebrow` (uppercase, `0.16em` tracking, bold, muted) above every field, `space-y-1` from its control — labels are never plain sentence-case `text-sm font-semibold`.
- **Focus:** `border-brand-teal` plus a 2px teal-tinted ring (`ring-brand-teal/15`) — no generic `ring-ring` border-color-only signal.
- **Compact/search variant:** smaller `h-6` pill-shaped field matching filter-pill height, so search sits inline with filters without breaking the row rhythm.
- **Shared primitive:** `fieldControlClass` in `src/components/ui/field.tsx` (paired with `<Field>`/`<FieldGroup>`/`<FieldRow>`) is the canonical implementation — reach for it before hand-rolling a field's className.

### Navigation (Sidebar)
- **Style:** dark ink-charcoal gradient surface (`--gradient-sidebar`), a deliberate contrast island against the light parchment content area — the one place the system inverts to dark.
- **Active state — two tiers, not one repeated pill.** A module with sub-pages (e.g. Tasks) shows two distinct signals at once, deliberately different in weight so they don't compete: the **parent row** gets an ambient teal wash (`bg-brand-teal/14`, teal-tinted border and icon) marking "you're in this module," while the **exact page** (the open sub-item, e.g. "Next Actions") gets the strong light pill (`bg-sidebar-foreground`) plus drop shadow — the system's one "here, precisely" signal. A single-page module with no children (People, Groups) goes straight to the light pill since it has no ambient/exact distinction to make. Teal marks location at the module level per the One Accent Rule; the light pill is reserved exclusively for the literal current page.
- **Hierarchy:** top-level sections are pill rows with icon + 13px extra-bold label; nested items are smaller (12px semibold) and indented behind a hairline left border, echoing the outer panel's border language at a smaller scale.
- **Collapsed state:** icon-only, centered, tooltips on hover — never truncated labels. No teal here at all: the active module's icon carries the same quiet `bg-sidebar-foreground/10` circle every icon shows on hover, just persistently rather than only while the pointer is over it, plus a small rounded notch (`bg-background`) biting into the sidebar's right edge at that row — the page content reading as if it bleeds through next to the active icon. The tooltip appends the open sub-page name (e.g. "Tasks · Next Actions") for the precise location.
- **Mobile:** a separate dock pattern (11px extra-bold labels, 32px icon targets) rather than a collapsed sidebar.
- **Scroll track:** thin (6px), transparent track, sidebar-foreground-tinted thumb at low opacity — the OS default scrollbar never appears against the dark surface.
- **Focus:** every nav link and icon-only control carries its own `focus-visible:ring-2 ring-sidebar-ring ring-offset-2 ring-offset-sidebar` — the dark surface never relies on the browser's unstyled default outline.
- **Muted text floor:** de-emphasized sidebar text (footer role, empty states, section labels) never drops below `sidebar-foreground/58` — anything lower fails 4.5:1 against the dark surface. Icon-only glyphs (not text) may go lower since they only need to clear 3:1.



## Do's and Don'ts

### Do:
- **Do** use Sacristy Teal for exactly one thing per screen: the primary action or the current location. Never two unrelated teal elements competing for the eye.
- **Do** keep the base page background Parchment, reserving pure white for raised surfaces only.
- **Do** lead hierarchy with font-weight (800/700 vs 400/500) before reaching for a larger size.
- **Do** keep shadows under ~10% opacity — a lift, never a hard drop.
- **Do** use the sage/sand/bronze categorical set for tags and categories that need to stay visually subordinate to teal.

### Don't:
- **Don't** introduce a second saturated accent color. Sage, sand, and bronze are muted categorical colors, not competing brand colors.
- **Don't** use sharp (0-radius) corners anywhere in the product — every control has at least `--radius-control`.
- **Don't** signal state (active/error/success) by color alone — pair with icon, weight, or position, per the accessibility floor in `.ai/PRODUCT_GUIDE.md`.
- **Don't** let cards or panels stack multiple visible shadows — pick one elevation step per surface.
