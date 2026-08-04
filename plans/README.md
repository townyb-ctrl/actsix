# Animation improvement plans

Written by `improve-animations` at commit `76b92946`. Audit scope: Tasks
module + app-wide navigation chrome (no JS motion library — Tailwind
utility transitions + shadcn/Radix `data-state` animations only).

| # | Title | Severity | Status | Depends on |
|---|---|---|---|---|
| [001](001-mobile-switcher-transform-not-size.md) | Mobile switcher panel: animate transform, not width/height | HIGH | TODO | — |
| [002](002-action-row-scope-transition.md) | Scope `.action-row`'s `transition-all` to actual properties | MEDIUM | TODO | — |
| [003](003-task-row-press-feedback.md) | Add press feedback to task rows, buttons, and dock icons | MEDIUM | TODO | Soft dependency on 002 (see plan for detail) |
| [004](004-mobile-nav-transition-token.md) | Consolidate MobileBottomNav's duplicated transition string | LOW | TODO | Must run after 001 |
| [005](005-guided-tour-spotlight-transform.md) | GuidedTour spotlight: position via transform, not top/left | LOW | TODO | — |

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
