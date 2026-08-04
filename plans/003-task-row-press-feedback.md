# 003 — Add press feedback to task rows, buttons, and dock icons

- **Status**: TODO
- **Commit**: 76b92946
- **Severity**: MEDIUM
- **Category**: Physicality & origin (press feedback)
- **Estimated scope**: 3 files, ~6 small edits

## Problem

The app has zero tactile press feedback on its highest-frequency tap
targets. Per `AUDIT.md` §3: *"Press feedback: `transform: scale(0.97)` on
`:active` with `transition: transform 160ms ease-out`."* Only two elements
in the entire codebase have this (`MobileBottomNav.tsx`'s FAB and
module-switcher buttons, `active:scale-95`). Missing everywhere else:

**Task rows** (`CompactTaskRow.tsx` — clicked/tapped constantly to open the
task editor, this is the core interaction of the product):

```tsx
// src/components/CompactTaskRow.tsx:154-159 — current
<div
  className={`action-row group flex items-center gap-2.5 px-3 py-1.5 ${
    clickable ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40" : ""
  } ${
    isComplete ? "opacity-70" : ""
  }`}
```

**Primary buttons** (`index.css` — `.actsix-btn-primary`/`-soft`/`-outline`,
used on every "Save", "Capture", filter-toggle action across the app):

```css
/* src/index.css:293-352 — current (primary shown, soft/outline follow the same shape) */
.actsix-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-control);
  background-color: hsl(var(--brand-teal));
  color: #ffffff;
  border: 1px solid hsl(var(--brand-teal));
  box-shadow: 0 4px 12px rgba(45, 140, 140, 0.24);
  transition: var(--transition-normal);
}

.actsix-btn-primary:hover {
  background-color: hsl(var(--brand-teal-dark));
  color: #ffffff;
  transform: translateY(-1px);
}
```

**Bottom dock icons** (`MobileBottomNav.tsx`'s `DockLink` — the 4 primary
navigation icons tapped to switch modules on every mobile session):

```tsx
// src/components/MobileBottomNav.tsx:438-461 — current
const DockLink = ({ item, active }: { item: MobileDockLink; active: boolean }) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      aria-current={active ? "page" : undefined}
      className={cn(
        "actsix-mobile-dock-item group flex min-h-[58px] flex-col items-center justify-center gap-1",
        active && "text-brand-teal"
      )}
    >
```

## Target

Per `AUDIT.md`: keep the scale subtle, `0.95`–`0.98`. This codebase's
DESIGN.md "Whisper Rule" (soft everything, restraint is the brand) means we
should sit at the gentle end: `scale(0.98)`.

```css
/* target: src/index.css .action-row */
.action-row {
  @apply border border-transparent bg-background/45 transition-[background-color,border-color,box-shadow,opacity,transform];
  border-radius: var(--radius-control);
}

.action-row[role="button"]:active {
  transform: scale(0.98);
}
```

```css
/* target: src/index.css .actsix-btn-primary (soft/outline get the identical addition) */
.actsix-btn-primary:active {
  transform: scale(0.98);
}
```

```tsx
// target: DockLink
className={cn(
  "actsix-mobile-dock-item group flex min-h-[58px] flex-col items-center justify-center gap-1 transition-transform duration-150 ease-out active:scale-[0.96]",
  active && "text-brand-teal"
)}
```

## Repo conventions to follow

- `MobileBottomNav.tsx`'s FAB button (`MobileBottomNav.tsx:635`) already
  uses `active:scale-95` as a Tailwind utility directly in `className` —
  that's the pattern for `DockLink` (Tailwind utility, not a new CSS rule),
  since `DockLink` is a plain Tailwind-styled component with no dedicated
  CSS class.
- `.action-row` and `.actsix-btn-*` are hand-written CSS classes in
  `src/index.css` under `@layer utilities` — new states for these belong
  as sibling CSS rules in the same file, following the existing
  `.action-row:hover { ... }` / `.actsix-btn-primary:hover { ... }` pattern
  immediately below each base rule.
- `--transition-normal: 160ms ease;` (`src/index.css:61`) is this file's
  existing transition-duration token for buttons — reuse it implicitly by
  not overriding `transition` on the `:active` rules (they inherit the
  base rule's `transition-[...]` list, which must include `transform`).

## Steps

1. In `src/index.css`, update `.action-row`'s `@apply` line (from plan 002 —
   if plan 002 has already run, its result already reads
   `transition-[background-color,border-color,box-shadow,opacity]`; add
   `,transform` to that list so this final list reads
   `transition-[background-color,border-color,box-shadow,opacity,transform]`.
   If plan 002 has NOT run yet, the base line will still read
   `transition-all` — in that case leave it as `transition-all` for this
   plan and do not change it here; plan 002 will handle scoping separately
   whenever it runs, and `transform` will be covered by `all` in the
   interim).
2. Immediately after `.action-row:hover { ... }` in `src/index.css`, add:
   ```css
   .action-row[role="button"]:active {
     transform: scale(0.98);
   }
   ```
   (Scoped to `[role="button"]` because `CompactTaskRow.tsx` only sets
   `role="button"` when the row is clickable — see
   `CompactTaskRow.tsx:160`, `role={clickable ? "button" : undefined}` —
   this correctly excludes non-interactive rows, e.g. ones rendered
   without an `onEdit` handler, from getting press feedback for a tap that
   does nothing.)
3. Immediately after `.actsix-btn-primary:hover { ... }` in
   `src/index.css`, add:
   ```css
   .actsix-btn-primary:active {
     transform: scale(0.98);
   }
   ```
4. Immediately after `.actsix-btn-soft:hover { ... }` in `src/index.css`,
   add:
   ```css
   .actsix-btn-soft:active {
     transform: scale(0.98);
   }
   ```
5. Immediately after `.actsix-btn-outline:hover { ... }` in
   `src/index.css`, add:
   ```css
   .actsix-btn-outline:active {
     transform: scale(0.98);
   }
   ```
6. In `src/components/MobileBottomNav.tsx`, update `DockLink`'s `className`
   (the `cn(...)` call inside the `<Link>`) — add
   `transition-transform duration-150 ease-out active:scale-[0.96]` to the
   always-on base string (first argument to `cn`), leaving the
   `active && "text-brand-teal"` conditional untouched.

## Boundaries

- Do NOT add press feedback to `.actsix-filter-pill`, `.actsix-view-tab`,
  `.actsix-segmented-item`, or any other interactive class not named
  above — those are out of scope for this plan; if they need it, that's a
  separate finding.
- Do NOT change hover behavior, colors, or shadows on any of the touched
  classes — only add new `:active`/`active:` rules.
- Do NOT touch `CompactTaskRow.tsx`'s row `<div>` className directly —
  the `.action-row[role="button"]:active` CSS rule handles it without a
  component-file edit.
- Do NOT add press feedback to icon-only edit/delete buttons inside
  `CompactTaskRow` (the shadcn `<Button variant="ghost" size="icon">`
  elements) — those are a different component (`Button` from
  `@/components/ui/button`) and out of scope here.
- If any of the current code at these locations doesn't match the
  snippets above (drift since commit `76b92946`), STOP and report instead
  of improvising.

## Verification

- **Mechanical**: `npx tsc -p tsconfig.app.json --noEmit` (expect clean),
  `npm run build` (expect success).
- **Feel check**: run `npm run dev`:
  - On `/tasks/next`, click and hold a task row — it should visibly shrink
    to 98% while pressed, spring back on release, no layout shift (row
    stays centered, doesn't jump).
  - Click a "Capture first task" / any `.actsix-btn-primary` button, hold
    the mouse down before releasing — same subtle shrink.
  - At a mobile viewport, tap and hold a bottom-dock icon (Home, etc.) —
    visible 96% shrink.
  - Open DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` —
    the scale-on-press is a state-change transition, not a decorative
    entrance; per `AUDIT.md` §6 ("reduced motion means fewer and gentler
    animations, not zero — keep transitions that aid comprehension, remove
    position changes") this feedback may stay as-is since it's a subtle
    scale, not a position/movement animation — confirm it still fires (no
    reduced-motion media query was added around it, which is correct).
  - Confirm no row/button visibly shifts its neighbors when pressed
    (scale from center should not push adjacent rows — check the row
    above/below a pressed task row doesn't jump).
- **Done when**: every task row, `.actsix-btn-*` button, and dock icon
  gives a visible, subtle (2-4%) press-in response with no layout shift.
