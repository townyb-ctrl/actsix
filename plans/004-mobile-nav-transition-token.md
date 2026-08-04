# 004 — Consolidate MobileBottomNav's duplicated transition string

- **Status**: TODO
- **Commit**: 76b92946
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, 8 occurrences → 1 shared constant

## Problem

`src/components/MobileBottomNav.tsx` hand-types the exact same transition
string `transition-all duration-200 ease-out` 8 times (verify exact count
against current file — it was 8 at commit `76b92946`, at lines
approximately 568, 578, 597, 627, 635, 643, 653, 661). Any future change to
this component's animation timing (e.g. after plan 001 changes two of these
to `transition-[transform,opacity]`) requires hunting down and editing
every occurrence individually, and it's easy to miss one.

**Note**: this plan should run AFTER plan 001, since plan 001 changes the
transitioned *properties* (not just consolidates the string) on 2 of the 8
occurrences. Running this plan first would create a shared constant that
plan 001 then has to partially un-apply.

## Target

Extract a local constant at the top of the file (or immediately above the
component that uses it) holding the shared class string, and reference it
via template literal / `cn()` at each call site. Since Tailwind's compiler
needs to see full class strings statically (not string-concatenated
fragments) to include them in the build, use a plain exported string
constant containing the complete utility classes — Tailwind's JIT scans
`.tsx` source text for class-like tokens regardless of whether they're
inside a JSX `className` attribute or a nearby string literal in the same
file, so a top-level `const` in this file is safe.

```tsx
// target: top of src/components/MobileBottomNav.tsx, after imports
const DOCK_TRANSITION = "transition-all duration-200 ease-out";
```

Then each of the 8 (or 6, if plan 001 already ran and changed 2 of them to
`transition-[transform,opacity] duration-200 ease-out`) occurrences becomes:

```tsx
// before
className="pointer-events-none absolute left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-brand-teal shadow-[0_10px_24px_rgba(45,140,140,0.24)] transition-all duration-200 ease-out"

// after
className={`pointer-events-none absolute left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-brand-teal shadow-[0_10px_24px_rgba(45,140,140,0.24)] ${DOCK_TRANSITION}`}
```

(For occurrences already inside a `cn(...)` call, add `DOCK_TRANSITION` as
its own argument to `cn(...)` instead of interpolating — cleaner and matches
existing `cn()` usage in this file, e.g.
`cn("...", DOCK_TRANSITION, switcherOpen ? "..." : "...")`.)

## Repo conventions to follow

- This file already imports `cn` from `@/lib/utils` and uses it for every
  conditional className in the file (`MobileBottomNav.tsx:568, 578, 597,
  627, 635, 643, 653, 661` all currently use `cn(...)`) — prefer adding
  `DOCK_TRANSITION` as a `cn()` argument over template-literal
  interpolation wherever the call site already uses `cn(...)`, for
  consistency with the rest of the file. Only use a plain template literal
  if a call site is a bare `className="..."` string with no `cn()` wrapper
  (check each occurrence's current form before editing).
- Constant naming: this file has no existing top-of-file constants to
  match against — `DOCK_TRANSITION` is a new, self-explanatory name; keep
  it `UPPER_SNAKE_CASE` matching the rest of the codebase's constant
  convention (e.g. `RECURRING_MEETINGS_STORAGE_KEY` in
  `src/components/AppSidebar.tsx:71`).

## Steps

1. Re-read `src/components/MobileBottomNav.tsx` in full and list every
   occurrence of the literal string `transition-all duration-200 ease-out`
   (or, if plan 001 already ran, also note any occurrence now reading
   `transition-[transform,opacity] duration-200 ease-out` — those are a
   *different* string and must NOT be merged into `DOCK_TRANSITION`; they
   need their own constant, e.g. `DOCK_TRANSITION_TRANSFORM`, or can stay
   inline since there are only 2 of them per plan 001).
2. Add `const DOCK_TRANSITION = "transition-all duration-200 ease-out";`
   near the top of the file, after the last `import` statement and before
   the first component/type definition.
3. Replace each of the plain (`transition-all duration-200 ease-out`)
   occurrences found in step 1 with a reference to `DOCK_TRANSITION`,
   using `cn()` argument style where the call site already uses `cn()`,
   template-literal interpolation otherwise.
4. Leave any occurrence plan 001 already converted to
   `transition-[transform,opacity] duration-200 ease-out` as inline
   strings (do not force them into the shared constant — they're now a
   different value).

## Boundaries

- Do NOT change any duration, easing, or transitioned-property value —
  this is a pure string-deduplication refactor, zero visual change.
- Do NOT touch any file other than `src/components/MobileBottomNav.tsx`.
- Do NOT introduce a global CSS custom property or a shared tokens file for
  this — it's local to this one component; a cross-file token system is
  out of scope.
- If the count of matching occurrences found in step 1 differs
  significantly from the 8 named in Problem (e.g. because plan 001 or 003
  already changed several), that's expected — adjust step 3's scope to
  match what's actually in the file, but do not invent new transition
  values.

## Verification

- **Mechanical**: `npx tsc -p tsconfig.app.json --noEmit` (expect clean),
  `npm run build` (expect success — confirm the built CSS still contains
  `transition-property`/`transition-duration`/`transition-timing-function`
  declarations matching the pre-refactor output; Tailwind must have picked
  up the class names from the template literals/`cn()` calls).
- **Feel check**: run `npm run dev`, open the mobile switcher, hover dock
  items — every animation in this component should look and time
  identically to before the refactor (this is a no-visual-change plan;
  any visible difference is a bug).
- **Done when**: `grep -c "transition-all duration-200 ease-out"
  src/components/MobileBottomNav.tsx` returns 0 (all occurrences now
  reference the constant), and the app looks pixel-identical to before.
