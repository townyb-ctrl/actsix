# 002 — Scope `.action-row`'s `transition-all` to actual properties

- **Status**: TODO
- **Commit**: 76b92946
- **Severity**: MEDIUM
- **Category**: Performance (`transition: all` is always a finding)
- **Estimated scope**: 1 file, 1 line changed

## Problem

`.action-row` is the base class for every task row in the app
(`CompactTaskRow.tsx`, used on `TasksPage`, `TasksDashboardPage`,
`ProjectTaskPane`/`ProjectsPage`, `InboxPage` via its own row markup) — the
single most frequently interacted element in the product (task lists are the
core workflow). It uses `transition-all`:

```css
/* src/index.css:278-287 — current */
.action-row {
  @apply border border-transparent bg-background/45 transition-all;
  border-radius: var(--radius-control);
}

.action-row:hover {
  border-color: hsl(var(--brand-teal) / 0.3);
  background-color: hsl(var(--brand-teal) / 0.05);
  box-shadow: var(--shadow-soft);
}
```

`transition-all` currently only ends up animating `border-color`,
`background-color`, and `box-shadow` (from the `:hover` rule above) plus
`opacity` (from `CompactTaskRow.tsx`'s conditional `isComplete ? "opacity-70" : ""`
class, applied to the same element). But `transition-all` also means: if
anyone in the future adds a class that changes `padding`, `margin`,
`width`, or any other layout property to this row (very plausible — it's a
shared, actively-developed component), it will silently start animating
too, causing layout thrash on the app's highest-frequency element with no
one noticing until a profiler catches it.

## Target

```css
/* target */
.action-row {
  @apply border border-transparent bg-background/45 transition-[background-color,border-color,box-shadow,opacity];
  border-radius: var(--radius-control);
}
```

## Repo conventions to follow

- This file (`src/index.css`) already mixes `@apply` with hand-written CSS
  properties inside `@layer utilities` — keep that same mixed style, just
  change the one `@apply` token from `transition-all` to the explicit
  arbitrary-property syntax.
- `.actsix-btn-primary` a few lines below (`index.css:293-321`) already uses
  a named CSS custom property for its transition
  (`transition: var(--transition-normal);`, where
  `--transition-normal: 160ms ease;` is defined at `index.css:61`) rather
  than `transition-all` — that's the pattern to follow *conceptually*
  (scoped, not blanket), though `.action-row` should stay as a Tailwind
  arbitrary-value utility (via `@apply`) rather than switching to the CSS
  custom property, to minimize diff and match its own existing style.

## Steps

1. In `src/index.css`, find the `.action-row` rule (currently reads
   `@apply border border-transparent bg-background/45 transition-all;`).
   Change `transition-all` to
   `transition-[background-color,border-color,box-shadow,opacity]`.
2. Do not touch the `.action-row:hover` block or any other rule in this
   file.

## Boundaries

- Do NOT touch any other utility class in `src/index.css` (this file has
  several other `transition-all`/`transition` usages outside
  `.action-row` — out of scope for this plan).
- Do NOT touch `CompactTaskRow.tsx` or any component file — this is a
  single CSS-rule change.
- Do NOT add a CSS custom property or token for this — the arbitrary-value
  Tailwind syntax is correct here, matching the plan's Target exactly.
- If the current `.action-row` rule doesn't match the snippet above (drift
  since commit `76b92946`), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` (expect success — Tailwind must compile
  the arbitrary-value transition utility without error; if it fails,
  confirm the exact bracket syntax `transition-[background-color,border-color,box-shadow,opacity]`
  has no spaces inside the brackets, which Tailwind's arbitrary-value
  parser requires).
- **Feel check**: run `npm run dev`, go to `/tasks/next`:
  - Hover a task row — border/background/shadow still fade in smoothly
    (same ~150ms feel as before, unchanged duration since none was
    specified before or now — verify it still uses the browser default
    transition-duration inherited from... actually confirm: since no
    `duration-*` class exists on `.action-row`, the transition currently
    runs at Tailwind's default `150ms` — this must be unchanged after the
    edit).
  - Check a task's checkbox to mark it complete — the row still fades to
    `opacity-70` smoothly, not an instant snap. This is the regression to
    watch for: if `opacity` was accidentally left out of the bracket list,
    completing a task will snap instead of fade.
  - Open DevTools → Elements → select a task row → Computed styles →
    confirm `transition-property` now lists exactly
    `background-color, border-color, box-shadow, opacity` (not `all`).
- **Done when**: hovering and completing a task row look and feel
  identical to before, and DevTools confirms `transition-property` is no
  longer `all`.
