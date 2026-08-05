# 005 — GuidedTour spotlight: position via transform, not top/left

- **Status**: DONE
- **Commit**: 76b92946
- **Severity**: LOW
- **Category**: Performance (Animate `transform`/`opacity` only)
- **Estimated scope**: 1 file, ~1 function + 2 style objects changed

## Problem

`src/components/GuidedTour.tsx` positions its spotlight highlight box and
tooltip card using inline `top`/`left` style properties, computed by a
function and animated via `transition-all duration-300`:

```tsx
// src/components/GuidedTour.tsx:374 — current
className="absolute border-2 border-brand-teal-bright bg-transparent shadow-[0_0_22px_rgba(45,140,140,0.35)] transition-all duration-300"
```

```tsx
// src/components/GuidedTour.tsx:379 — current
className="pointer-events-auto fixed w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/70 bg-card text-foreground shadow-lg transition-all duration-300"
```

with position values coming from a calculation function around
`GuidedTour.tsx:261-292` that returns `{ left, top }` (and likely `width`/
`height` for the spotlight box — confirm by reading the function's full
return shape before editing) applied via an inline `style={{ ... }}`
prop. `top`/`left` are layout properties (unlike `transform:
translate(...)`, which is composited) — animating them forces a layout
recalculation on every frame of the 300ms transition.

**Severity is LOW, not HIGH**, because `GuidedTour` only renders during
first-run onboarding for a given module (per `AppLayout.tsx`'s
`startGuidedTour` logic, gated on `!isComplete` in user settings) — this is
the "rare/first-time" frequency bucket per `AUDIT.md` §1, where the cost of
an imperfect implementation is far lower than on `MobileBottomNav` (plan
001) or `.action-row` (plan 002), which render on every screen. Still worth
fixing since the mechanism is simple and the component already does the
hard part (computing the target rect).

## Target

Keep the existing `{ left, top }` calculation function exactly as-is (it
correctly computes the *final resting position* in each step) — the only
change is how that position is applied to the DOM: via
`transform: translate(x, y)` from a fixed `top: 0; left: 0` anchor, instead
of animating `top`/`left` directly.

```tsx
// target: wherever the spotlight/tooltip position is currently applied
// (read the component to find the exact style={{ left, top }} usage before
// editing — likely near GuidedTour.tsx:370-385)
style={{
  transform: `translate(${position.left}px, ${position.top}px)`,
}}
```

with the className's `top`/`left` no longer needed in the inline style
object, and the base positioning classes changed from `absolute`/`fixed`
with dynamic `top`/`left` to `absolute top-0 left-0`/`fixed top-0 left-0`
(a static anchor) plus the dynamic `transform`.

```tsx
// target: className changes
// spotlight box
className="absolute left-0 top-0 border-2 border-brand-teal-bright bg-transparent shadow-[0_0_22px_rgba(45,140,140,0.35)] transition-transform duration-300"

// tooltip card
className="pointer-events-auto fixed left-0 top-0 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/70 bg-card text-foreground shadow-lg transition-transform duration-300"
```

If the spotlight box also animates `width`/`height` (to match the
highlighted element's size, not just position) — confirm this by reading
the full return value of the position-calculation function — width/height
of a *highlight outline* cannot be expressed as a transform and should
stay as directly-set (non-animated, or `transition-[width,height]` only if
truly needed) properties; do not force width/height into the transform.
Only `top`/`left` are in scope for this plan.

## Repo conventions to follow

- `duration-300 ease-out` (implicit default easing, since no `ease-*`
  class is specified — confirm the current classes don't already have an
  explicit easing utility before assuming default) is this component's
  existing timing — keep it unchanged, this plan only changes which CSS
  property carries the motion.
- The `clamp(...)` calls inside the position function
  (`GuidedTour.tsx:271-292`) already do the hard work of keeping the
  tooltip on-screen — do not modify that math, only change how the
  resulting numbers are applied to the DOM.

## Steps

1. Read `src/components/GuidedTour.tsx` in full to find:
   a. The exact shape of the object returned by the position-calculation
      function (confirm whether it returns only `{ left, top }` or also
      `width`/`height`).
   b. Every place that object's values are consumed via an inline
      `style={{ ... }}` prop (there are at least 2: the spotlight box
      around line 374, the tooltip card around line 379 — there may be
      more; find all of them).
2. For each consumption site found in step 1b, change the inline style
   from `{ left: x, top: y }` (or however the current code destructures
   it) to `{ transform: \`translate(${x}px, ${y}px)\` }`, keeping any
   other existing style properties (e.g. `width`/`height` on the
   spotlight box, if present) unchanged in the same style object.
3. Update each corresponding `className` to replace the implicit
   `top`/`left` positioning (whatever `absolute`/`fixed` positioning
   classes currently exist without explicit `top-0 left-0`) with
   `top-0 left-0` added explicitly, and change `transition-all` to
   `transition-transform` (or `transition-[transform,width,height]` if
   width/height are confirmed to be present and animated in step 1a — do
   not silently drop an existing width/height animation without
   preserving it under an explicit property list).

## Boundaries

- Do NOT modify the `clamp(...)`-based position-calculation logic itself —
  only how its output is applied to the DOM.
- Do NOT touch any other part of `GuidedTour.tsx` (tour-step content,
  navigation buttons, `onStepChange`/`onComplete` callback logic) — those
  are unrelated to this motion fix.
- Do NOT touch `AppLayout.tsx` or any file that invokes `GuidedTour` — this
  plan is scoped entirely to `GuidedTour.tsx`'s internal rendering.
- If step 1 reveals the current code structure differs meaningfully from
  what's described here (e.g. position is applied via a CSS custom
  property instead of inline `style`, or via a third-party positioning
  library) — STOP and report instead of improvising a fix for a different
  mechanism than described.

## Verification

- **Mechanical**: `npx tsc -p tsconfig.app.json --noEmit` (expect clean),
  `npm run build` (expect success).
- **Feel check**: run `npm run dev`, trigger a guided tour (log in as a
  user with an incomplete onboarding tour, or find the "Start Tutorial"
  option in the account menu per `AppLayout.tsx`'s
  `startGuidedTour(getModuleKeyForPath(...))` call) and step through it:
  - The spotlight box and tooltip card still glide smoothly to each new
    target element, visually identical timing/distance to before.
  - Open DevTools → Elements → select the spotlight box while stepping
    through the tour — confirm `top`/`left` in Computed styles stay at
    `0px` throughout, and only `transform` changes between steps.
  - Open DevTools → Performance panel, record while stepping through 3-4
    tour steps — confirm no "Layout" (purple) entries attributable to the
    spotlight/tooltip elements.
  - Resize the browser window mid-tour (or rotate a mobile emulator) —
    confirm the spotlight still repositions correctly on the next step
    (the `clamp(...)` boundary logic must still work identically, since it
    was untouched).
- **Done when**: the tour visually behaves identically to before, and
  DevTools confirms the spotlight/tooltip move via `transform` only, with
  `top`/`left` fixed at `0` in computed styles.
