# 006 — Wrap PA/coffee fee reveal in height+opacity transition

- **Status**: TODO
- **Commit**: 0733ec77
- **Severity**: MEDIUM
- **Category**: Missed opportunity / Purpose & frequency (preventing jarring change)
- **Estimated scope**: 1 file, ~20 line diff

## Problem

`src/features/venues/components/VenueBookingModal.tsx:543-555` and `:566-578` conditionally render a `Field` (fee input) directly beneath a `CheckboxField` when the user ticks "PA System" or "Tea & Coffee". Today the `Field` is a plain `{paRequested && (...)}` / `{coffeeRequested && (...)}` JSX conditional — it mounts and unmounts instantly, so the form jumps in height with no bridge the instant either checkbox is toggled.

Current code (PA branch):

```tsx
// src/features/venues/components/VenueBookingModal.tsx:536-555 — current
<CheckboxField
  id="venue-booking-pa"
  label="PA System"
  checked={paRequested}
  onCheckedChange={setPaRequested}
  className="text-sm font-normal"
/>
{paRequested && (
  <Field label="PA fee" htmlFor="venue-booking-pa-fee">
    <input
      id="venue-booking-pa-fee"
      type="number"
      min="0"
      step="0.01"
      value={paFee}
      onChange={(event) => setPaFee(event.target.value)}
      className={cn(fieldControlClass)}
    />
  </Field>
)}
```

Same pattern for the coffee branch at `:558-579`:

```tsx
// src/features/venues/components/VenueBookingModal.tsx:558-579 — current
<CheckboxField
  id="venue-booking-coffee"
  label="Tea & Coffee"
  checked={coffeeRequested}
  onCheckedChange={setCoffeeRequested}
  className="text-sm font-normal"
/>
{coffeeRequested && (
  <Field label="Tea & coffee fee" htmlFor="venue-booking-coffee-fee">
    <input
      id="venue-booking-coffee-fee"
      type="number"
      min="0"
      step="0.01"
      value={coffeeFee}
      onChange={(event) => setCoffeeFee(event.target.value)}
      className={cn(fieldControlClass)}
    />
  </Field>
)}
```

This is a form inside a modal (`FormDialog`, occasional frequency — once per external booking at most) where a field teleporting in is the exact "content that swaps/appears with no bridge" case motion should smooth over. Not high-frequency, not keyboard-driven, not data the user is trying to read mid-motion — eligible.

## Target

Always render both `Field` wrappers; drive the reveal with a wrapper `div` whose `grid-template-rows` animates `0fr → 1fr` (the standard CSS-only technique for animating to auto height) and whose inner content fades with `opacity`. No JS measurement, no library.

```tsx
// target — PA branch
<div
  className={cn(
    "grid transition-[grid-template-rows] duration-200 ease-out",
    paRequested ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
  )}
>
  <div className="overflow-hidden">
    <Field
      label="PA fee"
      htmlFor="venue-booking-pa-fee"
      className={cn("pt-2 transition-opacity duration-200 ease-out", paRequested ? "opacity-100" : "opacity-0")}
    >
      <input
        id="venue-booking-pa-fee"
        type="number"
        min="0"
        step="0.01"
        value={paFee}
        onChange={(event) => setPaFee(event.target.value)}
        className={cn(fieldControlClass)}
      />
    </Field>
  </div>
</div>
```

Same structure for the coffee branch, swapping `paRequested`→`coffeeRequested`, `paFee`→`coffeeFee`, and the field's `label`/`htmlFor`/`id`.

Duration/easing: `200ms ease-out` — this repo has no `--ease-out` custom-property token (that name is reserved by `find-animation-opportunities`' generic vocabulary, not an actual token in this codebase). The real tokens here are `--transition-fast: 120ms ease` and `--transition-normal: 160ms ease` (`src/index.css:60-61`), both defined as full `transition` shorthand values, not composable curves — they don't fit a `transition-[grid-template-rows]` utility cleanly. Use Tailwind's built-in `ease-out` (`cubic-bezier(0, 0, 0.2, 1)`) at `duration-200`, which sits inside this modal's own budget (200-500ms) and matches the `duration-200` already used by `src/components/ui/dialog.tsx:39` for this same modal's open/close.

Reduced motion: add `motion-reduce:transition-none` to both animated elements — the height/opacity change still happens, just instantly, no partial states get stuck.

## Repo conventions to follow

- `cn(...)` from `@/lib/utils` is already imported and used throughout this file for conditional className composition (e.g. `fieldControlClass` usage) — keep using it, don't hand-roll template strings.
- `Field` (from `@/components/ui/field`) already accepts a `className` prop passed through to its wrapper — confirm this before step 1 (see Boundaries).
- The modal's own open/close animation (`src/components/ui/dialog.tsx:39`) uses `duration-200` — this plan's `duration-200` matches that existing budget rather than inventing a new one.
- Exemplar for the `grid-rows-[0fr]→[1fr]` auto-height technique: none exists yet in this repo — this is the first use. Keep it self-contained to these two blocks; do not extract a shared component for a 2-site pattern.

## Steps

1. Open `src/features/venues/components/VenueBookingModal.tsx`. Confirm `Field`'s type signature (`@/components/ui/field`) accepts and forwards a `className` prop to whatever element wraps the label+input. If it does not, apply the opacity transition to a plain wrapping `<div>` around the existing `<Field>...</Field>` instead of passing `className` into `Field` itself — do not modify `field.tsx`.
2. Replace the PA branch (current lines ~543-555) with the grid-rows wrapper shown in Target, keeping the `Field`'s `label`, `htmlFor`, `id`, and the `input`'s `value`/`onChange` exactly as they are today — only the wrapping structure and classNames change.
3. Replace the coffee branch (current lines ~566-578) the same way, substituting `coffeeRequested`/`coffeeFee`/`"Tea & coffee fee"`/`venue-booking-coffee-fee`.
4. Remove the `{paRequested && (...)}` / `{coffeeRequested && (...)}` conditionals — both `Field`s now always render; visibility is entirely CSS-driven so the input still exists (and is reachable by keyboard/screen readers) even at `grid-rows-[0fr]`. If this is undesirable (a hidden-but-focusable fee input), add `aria-hidden={!paRequested}` / `aria-hidden={!coffeeRequested}` on the outer wrapper `div` and `tabIndex={-1}` is not needed since `overflow-hidden` + zero row height already removes it from tab order visually but not from the DOM — confirm with a keyboard-only pass in Verification.
5. Add `motion-reduce:transition-none` to both the outer (`grid-template-rows`) and inner (`opacity`) transitioning elements.

## Boundaries

- Do NOT touch `@/components/ui/field.tsx` — if `Field` can't forward `className` as needed, wrap it in a plain `div` instead (see step 1).
- Do NOT touch any other conditional block in this file (e.g. the `bookingType === "external"` sections, the conflict `Alert`) — those are separate findings, not in scope here.
- Do NOT change the `paFee`/`coffeeFee` state logic, validation, or submit payload — motion-only change.
- Do NOT add a new dependency (no `framer-motion`, no JS height measurement) — this is a pure CSS technique.
- If the current code at these line numbers has drifted from what's quoted in Problem (e.g. the checkboxes were restructured), STOP and report instead of improvising a fix for different code.

## Verification

- **Mechanical**: `npm run typecheck` (or the repo's equivalent) — expect no new errors. No build step required for a className-only change.
- **Feel check**: open the venue booking modal, switch "Type" to "External hire", then:
  - Tick "PA System" — the fee field should grow in and fade in together, not pop instantly, and not overshoot/bounce.
  - Untick it — the field should shrink and fade out symmetrically (same duration, same curve, reverse direction).
  - Repeat for "Tea & Coffee" — both fields, if both ticked, should not visually collide or overlap during their independent transitions.
  - Rapidly double-click the checkbox mid-transition — the row should retarget smoothly from wherever it is, not restart from 0 or jump.
  - In DevTools Animations panel, set playback to 10% and confirm the row grows from the top down (no width jump, no content reflow of the fields above/below).
  - Toggle `prefers-reduced-motion: reduce` in the Rendering panel — the field should show/hide instantly with no growth animation, but should not flash or leave a 1px sliver.
  - Tab through the form with the fee field hidden — confirm focus does not land on the hidden PA/coffee fee input while its checkbox is unticked.
- **Done when**: both fee fields animate open/closed via height+opacity, match the modal's own `duration-200` budget, respect reduced motion, and no other conditional block in the file was touched.
