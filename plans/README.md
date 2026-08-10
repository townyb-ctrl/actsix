# Animation improvement plans

Written by `improve-animations` at commit `76b92946`. Audit scope: Tasks
module + app-wide navigation chrome (no JS motion library — Tailwind
utility transitions + shadcn/Radix `data-state` animations only).

| # | Title | Severity | Status | Depends on |
|---|---|---|---|---|
| [001](001-mobile-switcher-transform-not-size.md) | Mobile switcher panel: animate transform, not width/height | HIGH | DONE | — |
| [002](002-action-row-scope-transition.md) | Scope `.action-row`'s `transition-all` to actual properties | MEDIUM | DONE | — |
| [003](003-task-row-press-feedback.md) | Add press feedback to task rows, buttons, and dock icons | MEDIUM | DONE | Soft dependency on 002 (see plan for detail) |
| [004](004-mobile-nav-transition-token.md) | Consolidate MobileBottomNav's duplicated transition string | LOW | DONE | Must run after 001 |
| [005](005-guided-tour-spotlight-transform.md) | GuidedTour spotlight: position via transform, not top/left | LOW | DONE | — |
| [006](006-booking-modal-fee-field-reveal.md) | Wrap PA/coffee fee reveal in height+opacity transition | MEDIUM | TODO | — |

## Execution notes (2026-08-05)

All 5 executed manually in this session (the scheduled cloud routine fired
but produced no commits — cause unconfirmed, session transcript only
visible in the claude.ai routines UI, not fetchable via the tools
available here).

Plan 005 hit real drift: the spotlight box also animates `width`/`height`
(matches the highlighted element's size, not just position) — the plan had
already anticipated this exact branch and specified keeping width/height
as explicit non-`all` properties rather than forcing them into transform.
Followed that branch; no abort needed.

Commits landed on 3 files instead of 5 separate ones — `MobileBottomNav.tsx`
is touched by plans 001, 003, and 004, and this environment has no
`git add -p`, so those three were committed together (clearly labeled in
the commit message) rather than force-split.

## Recommended execution order

1. **001** first — it changes the properties `.MobileBottomNav` transitions;
   both 003 and 004 touch the same file and reference its output.
2. **002** — independent, but 003 reads its result (touches the same
   `.action-row` rule).
3. **003** — after 002, so the `:active` rule's `transition-[...]` list
   accounts for 002's scoping (plan 003 handles the case where 002 hasn't
   run too — order isn't hard-blocking, just cleaner in this sequence).
4. **004** — must run after 001 (it deduplicates the transition string
   001 partially changes; running 004 first would need un-merging).
5. **005** — fully independent, can run anytime, including in parallel
   with the others (different file, no shared state).

## Notes

- All 5 plans are additive/corrective CSS-and-className changes only — no
  new dependencies, no markup restructuring beyond adding/removing
  Tailwind utility classes.
- None of these plans touch `DESIGN.md` tokens or the sidecar
  (`.impeccable/design.json`) — they're implementation-detail fixes, not
  design-system changes.
- Missed opportunities noted in the audit (task-list entrance stagger) were
  not turned into a plan — the user selected all 5 corrective findings,
  not the additive one. Revisit with `improve-animations plan <description>`
  if wanted later.

## Plan 006 (2026-08-10)

Written via `improve-animations plan <description>` (single-plan mode, no
full audit) against the Venues feature, at commit `0733ec77` — a different
scope/commit than plans 001-005 above. Independent of them: touches
`VenueBookingModal.tsx`, no shared files. Uses Tailwind's built-in
`ease-out`/`duration-200` rather than this repo's `--transition-fast` /
`--transition-normal` tokens, since those are full `transition` shorthands
that don't compose with a `transition-[grid-template-rows]` utility — see
the plan's Target section for the reasoning.
