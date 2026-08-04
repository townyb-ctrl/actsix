# 001 — Mobile switcher panel: animate transform, not width/height

- **Status**: TODO
- **Commit**: 76b92946
- **Severity**: HIGH
- **Category**: Performance (Animate `transform`/`opacity` only)
- **Estimated scope**: 1 file, ~15 lines changed

## Problem

`src/components/MobileBottomNav.tsx` renders the mobile module switcher as a
small dot that grows into a pill-shaped panel. The growth is implemented by
animating `width` and `height` via Tailwind's `transition-all` — both are
layout properties (trigger layout + paint + composite), and this component is
mounted on every mobile screen (`md:hidden` nav, visible on every route).

Two elements do this:

```tsx
// src/components/MobileBottomNav.tsx:576-583 — current
<div
  className={cn(
    "absolute left-1/2 bottom-[5.5rem] z-20 flex h-12 origin-bottom -translate-x-1/2 items-center justify-between gap-1 overflow-hidden rounded-full border border-white/10 bg-brand-teal shadow-[0_16px_34px_rgba(45,140,140,0.26)] transition-all duration-200 ease-out",
    switcherOpen
      ? "pointer-events-auto w-[min(90%,21rem)] translate-y-0 scale-x-100 px-3 opacity-100"
      : "pointer-events-none w-12 translate-y-7 scale-x-[0.18] px-0 opacity-0"
  )}
>
```

```tsx
// src/components/MobileBottomNav.tsx:622-629 — current
<span
  className={cn(
    "pointer-events-none absolute left-1/2 top-[-0.5rem] h-6 w-8 -translate-x-1/2 rounded-b-full bg-white/95 shadow-[0_8px_14px_rgba(30,30,27,0.05)] transition-all duration-200 ease-out",
    switcherOpen && "h-7 w-9"
  )}
/>
```

The first element already animates `scale-x-[0.18]` → `scale-x-100` (a
transform) *in addition to* `w-12` → `w-[min(90%,21rem)]` (a layout
property) — the scale and the width-change are fighting to produce the same
visual growth, redundantly, through two different mechanisms.

## Target

The panel should reach its full size purely via `transform: scaleX(...)`
from a `transform-origin` at its own center (it already has
`origin-bottom` for the Y axis — add the X-axis equivalent), with `width`
**fixed** at its open size at all times. `overflow-hidden` on the panel
already clips the content while collapsed, so a fixed-width element scaled
down to `scaleX(0.18)` reads identically to the current `w-12` collapsed
state.

```tsx
// target
<div
  className={cn(
    "absolute left-1/2 bottom-[5.5rem] z-20 flex h-12 w-[min(90%,21rem)] origin-bottom -translate-x-1/2 items-center justify-between gap-1 overflow-hidden rounded-full border border-white/10 bg-brand-teal px-3 shadow-[0_16px_34px_rgba(45,140,140,0.26)] transition-transform duration-200 ease-out",
    switcherOpen
      ? "pointer-events-auto translate-y-0 scale-x-100 opacity-100"
      : "pointer-events-none translate-y-7 scale-x-[0.18] opacity-0"
  )}
>
```

Note: `px-3`/`px-0` toggling is dropped (padding is a layout property too,
and the collapsed state is invisible/clipped anyway — fixed `px-3` is fine
at all times since content is hidden behind `overflow-hidden` + `opacity-0`
when collapsed). `opacity-100`/`opacity-0` stays (transform+opacity only).
`transition-all` becomes `transition-transform` — opacity is a separate
Tailwind utility and transitions via the same `transition-transform`
declaration only if both are listed; use `transition-[transform,opacity]`
instead of `transition-transform` to keep the existing fade:

```tsx
// corrected target (transform AND opacity both need to transition)
className={cn(
  "absolute left-1/2 bottom-[5.5rem] z-20 flex h-12 w-[min(90%,21rem)] origin-bottom -translate-x-1/2 items-center justify-between gap-1 overflow-hidden rounded-full border border-white/10 bg-brand-teal px-3 shadow-[0_16px_34px_rgba(45,140,140,0.26)] transition-[transform,opacity] duration-200 ease-out",
  switcherOpen
    ? "pointer-events-auto translate-y-0 scale-x-100 opacity-100"
    : "pointer-events-none translate-y-7 scale-x-[0.18] opacity-0"
)}
```

The small notch span (`h-6 w-8` → `h-7 w-9`) is a decorative 4px size bump
on a tiny element — replace with a `scale-110`-style transform equivalent
instead of animating `height`/`width`:

```tsx
// target
<span
  className={cn(
    "pointer-events-none absolute left-1/2 top-[-0.5rem] h-6 w-8 origin-center -translate-x-1/2 rounded-b-full bg-white/95 shadow-[0_8px_14px_rgba(30,30,27,0.05)] transition-transform duration-200 ease-out",
    switcherOpen && "scale-x-[1.125] scale-y-[1.167]"
  )}
/>
```
(`1.125` = 9/8, `1.167` ≈ 7/6 — reproduces the `w-8→w-9`, `h-6→h-7` ratio via
transform instead of layout.)

## Repo conventions to follow

- Duration/easing convention in this file is `duration-200 ease-out` on
  every animated element — keep it exactly as-is, only the transitioned
  *properties* change.
- `cn(...)` (from `@/lib/utils`) is the existing className-merge pattern
  used throughout this file — keep using it, don't switch to a different
  merge helper.
- The dot indicator at `MobileBottomNav.tsx:566-573` already animates only
  `scale-x`/`scale-y`/`opacity`/`bottom` (bottom is a position offset, not a
  size — acceptable, matches existing pattern) — that element is already
  correct and is the exemplar for "transform-only" in this same file. Do
  not touch it.

## Steps

1. In `src/components/MobileBottomNav.tsx`, locate the switcher panel `<div>`
   at the line containing `bottom-[5.5rem] z-20 flex h-12 origin-bottom`.
   Replace its `className` per the "corrected target" above: add `w-[min(90%,21rem)]`
   and `px-3` to the always-on base classes, remove `w-[min(90%,21rem)] ... px-3`
   and `w-12 ... px-0` from the conditional branches, change
   `transition-all` to `transition-[transform,opacity]`, add `origin-center`
   is not needed here (origin-bottom already set for Y; scaleX from center
   default is correct since the panel is horizontally centered via
   `left-1/2 -translate-x-1/2` — leave `origin-bottom` as-is, it governs the
   Y-axis growth direction which must not change).
2. Locate the notch `<span>` at the line containing
   `top-[-0.5rem] h-6 w-8 -translate-x-1/2 rounded-b-full`. Add
   `origin-center`, change `transition-all` to `transition-transform`,
   replace the conditional `"h-7 w-9"` with `"scale-x-[1.125] scale-y-[1.167]"`.
3. Leave every other element in this file untouched (dot indicator,
   module-switcher buttons, FAB button, icon crossfade span) — none of them
   animate a layout property.

## Boundaries

- Do NOT touch `src/components/MobileBottomNav.tsx` outside the two
  elements named above (dot indicator, module-switcher buttons, FAB, icon
  crossfade, `DockLink` are all out of scope for this plan — `DockLink`
  press feedback is plan 003).
- Do NOT change the visual size, position, or timing — only the CSS
  mechanism producing the same visual result.
- Do NOT add new dependencies or a JS-driven resize observer.
- If the current code at these two locations doesn't match the snippets
  above (drift since commit `76b92946`), STOP and report instead of
  improvising.

## Verification

- **Mechanical**: `npx tsc -p tsconfig.app.json --noEmit` (expect clean),
  `npm run build` (expect success, no new warnings beyond the pre-existing
  chunk-size notice).
- **Feel check**: run `npm run dev`, open the app at a mobile viewport
  (DevTools device toolbar, e.g. iPhone 14), tap the center FAB to open the
  module switcher:
  - The panel still grows from the dot to the full pill in ~200ms, visually
    identical to before.
  - Open DevTools → Elements → select the panel `<div>` while toggling the
    switcher — confirm `width` in the computed styles panel stays constant
    (`min(90%, 21rem)`-resolved px value) at all times; only `transform`
    changes.
  - Open DevTools → Performance panel, record while toggling the switcher
    5-10 times rapidly — confirm no "Layout" (purple) entries are triggered
    by this component (some layout may still appear from other page
    activity; the goal is this component contributes none).
  - Toggle `prefers-reduced-motion: reduce` in DevTools Rendering panel —
    the panel should still open/close (this component has no explicit
    reduced-motion handling either way; confirm behavior is unchanged from
    before this plan — that's a separate, out-of-scope gap).
- **Done when**: the switcher panel and notch visually match current
  behavior exactly, but Chrome DevTools confirms only `transform`/`opacity`
  are animating (no `width`/`height` in the Layers/Performance trace).
