---
target: Meeting Agenda editor (MeetingAgendaModal.tsx)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-08-07T18-18-36Z
slug: eatures-meetings-components-meetingagendamodal-tsx
---
Method: dual-agent (A: a123427c718224163 · B: a910a6ab132be9f76)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Numbering live-updates correctly, but no persistent "unsaved" indicator while typing — only surfaced reactively at close |
| 2 | Match System / Real World | 4 | `1.1.1` numbering and Notes/Decisions skeleton mirror how these meetings are actually run on paper |
| 3 | User Control and Freedom | 3 | Discard-confirm on close and section-delete confirm both real; no undo anywhere, no reorder, point-delete has zero safety net |
| 4 | Consistency and Standards | 3 | Internal styling is consistent (shared size/focus classes); the *risk model* isn't — section delete confirms, point delete doesn't |
| 5 | Error Prevention | 2 | Point delete (line ~304) fires instantly, no confirm/undo; `cleanAgendaSections` silently drops blank sections on save |
| 6 | Recognition Rather Than Recall | 3 | Layout pills labeled and show pressed state, but "List/Dated/Boxed" meaning is unexplained — trial and error only |
| 7 | Flexibility and Efficiency | 2 | No drag-reorder, no duplicate-section, no keyboard shortcut to add next point — all mouse, one click at a time |
| 8 | Aesthetic and Minimalist Design | 3 | Clean parchment cards, correct One Accent Rule use throughout; gets busy where layout pills + tag/subtitle toggle share a row |
| 9 | Error Recovery | 2 | No inline validation feedback; silent section-drop-on-save has no diagnosis path |
| 10 | Help and Documentation | 1 | Three layout modes change what's written into Minutes with zero tooltip, hint, or preview anywhere |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: Mostly generic form-builder chrome, with two real ACTSIX touches. The `1` / `1.1` / `1.1.1` numbering scheme and the `"Tag, e.g. (Allan)"` placeholder show someone thought about how a ministry staff meeting actually gets written down. But the Subtitle field right next to it has no matching example, and stripped of those two details this is indistinguishable from any generic "sections + items" CRUD form — `Card` + `Input` + `Plus`/`Trash2`, "Add Section" / "Save Agenda". Passes narrowly, on two details, not a systemic voice.

**Deterministic scan**: `detect.mjs --json` on the target file returned exit 0, zero findings (`[]`). Confirmed as a genuine clean scan, not a broken run — file resolved (469 lines), detector module loaded without error. The mechanical detector catches DOM/CSS anti-patterns; it has nothing to say about product-specificity or IA, which is exactly what Assessment A's issues above are about.

**Visual overlays**: No overlay injection was attempted (a clean live screenshot + full a11y-tree snapshot of the real "Staff Meeting" agenda in the browser was judged sufficient evidence, per the assessment's own scope). Screenshot showed no clipping, overflow, or broken layout in the visible viewport; spacing between sections read as clean and consistent. The one layout finding below (header/footer scrolling away) comes from the a11y-tree structure (no sticky classes on `DialogHeader`/`DialogFooter`) plus Assessment A's own live scroll-test, not from a rendering defect the screenshot alone would show.

## Overall Impression

Small agenda (1-2 sections): calm, legible, on-brand. Real agenda (the actual 7-section "Staff Meeting" data both assessments tested against): the editor stops scaling. Everything renders flat with no way to focus on one section, and the header, description, and both action buttons (Save Agenda, Add Section) scroll off-screen together — by section 7 you can't see the button that saves your work. Layered onto that: the delete-confirmation policy is inconsistent (sections ask, points and sub-points don't) despite the product principle of "never punish mistakes," and the layout picker (List/Dated/Boxed) silently changes what lands in the generated Minutes document with no explanation anywhere in the UI. The biggest opportunity is making this editor behave like it was designed for a real recurring agenda, not a 2-section demo.

## What's Working

1. **Discard-confirm on close** — the dirty-check against a `baselineRef` snapshot closes a real, previously-silent data-loss hole (confirmed in source, `MeetingAgendaModal.tsx:87-107`). The right instinct, done right.
2. **`1` / `1.1` / `1.1.1` numbering** — zero learning curve for anyone who's run a church staff meeting off paper; this is the one place the editor speaks the user's actual language.
3. **Tag/Subtitle progressive disclosure** — stays collapsed unless a section already has a tag or subtitle, so existing content is never hidden and empty sections stay uncluttered. The one place the modal actively resists clutter without hiding user content.

## Priority Issues

**[P1] No way to navigate a long agenda.** Live-tested against the real 7-section "Staff Meeting": all sections render flat with no accordion/collapse/section-jump, and `DialogHeader`/`DialogFooter` scroll away with the content (no sticky positioning) — Save Agenda and Add Section are ~1700px of scroll below section 1. This is the gap between "designed for the demo" and "designed for the Thursday-afternoon user with a real recurring agenda."
- **Why it matters**: A user editing their actual weekly agenda loses sight of Save entirely and has no way to jump to the section they need — exactly the "busier, not calmer" failure the design system explicitly rejects.
- **Fix**: Make `DialogHeader` and the footer buttons sticky (top/bottom) within the scroll container, and/or collapse sections to just their heading + point-count by default, expanding on click.
- **Suggested command**: `/impeccable layout`

**[P2] Inconsistent delete safety.** Section delete confirms via `ConfirmDialog`; point delete (~line 304) and sub-point delete (~line 354) fire instantly with no confirm and no undo, for content that can hold just as much typed work.
- **Why it matters**: Trains distrust — the same interface protects you sometimes and not others, for no reason the user can predict, directly against the stated "never punish mistakes" principle.
- **Fix**: Either extend the confirm-when-non-empty pattern already built for sections down to points, or add a lightweight "Undo" toast for point/sub-point removal instead of a full confirm dialog (lower-friction, still recoverable).
- **Suggested command**: `/impeccable harden`

**[P2] Layout picker is unexplained.** "List / Dated / Boxed" changes what actually gets written into the generated Minutes document (`generateMinutesFromAgenda`, `meetingAgenda.ts:242-267`), with zero hint, tooltip, or preview in the modal.
- **Why it matters**: Pure guesswork for anyone who hasn't read the source — a first-time user has no way to predict what picking "Dated" over "Boxed" will actually produce in their minutes.
- **Fix**: A one-line caption under the pills ("Dated: shows a date per point. Boxed: plain list, no dates.") or a live mini-preview of the generated output.
- **Suggested command**: `/impeccable clarify`

**[P3] No section heading semantics.** Confirmed in the a11y tree: section numbers render as plain `StaticText`, not headings. On a 7-section agenda a screen-reader user gets 40+ linear tab stops with no way to jump section-to-section.
- **Why it matters**: Screen-reader users can't use standard heading-navigation to orient on a long agenda — the exact accessibility gap the product's stated a11y bar (proper labels, keyboard nav) is meant to prevent.
- **Fix**: Wrap each section's number/heading in an `<h3>` (visually unchanged, `sr-only` or styled as today).
- **Suggested command**: `/impeccable audit`

**[P2] Silent data loss on save.** `cleanAgendaSections` drops any section left with a blank heading and no points, with zero toast or warning.
- **Why it matters**: An accidentally-cleared section just vanishes on save with no diagnosis path — a "did my content just disappear?" moment with no way to tell what happened.
- **Fix**: Toast a one-line notice when sections are dropped during save ("1 empty section removed"), or refuse to silently prune and let the user confirm.
- **Suggested command**: `/impeccable harden`

## Persona Red Flags

**Jordan (First-Timer)**: Opens the modal on a real multi-section recurring agenda, sees three unlabeled-in-effect layout pills and has to guess what they do; starts editing section 1, and by the time they scroll down to check their work, Save Agenda is out of view — genuine "did this even save?" anxiety with no way to resolve it without scrolling back up.

**Sam (Accessibility)**: No heading landmarks between sections means no jump-navigation via screen reader; on the real 7-section agenda that's a long, undifferentiated tab sequence with no way to orient without reading every single label in order.

## Minor Observations

- `"Tag, e.g. (Allan)"` is a nice specific placeholder; `Subtitle`'s placeholder has no matching example — fix the asymmetry for a small but real specificity win.
- The One Accent Rule is followed correctly and consistently everywhere it matters (pressed pill, add-links, number badges, focus rings) — no strikes here, worth calling out as a genuine strength.
- No drag-reorder for sections or points — reordering a real agenda today means delete-and-retype from scratch.
- Deterministic scan came back clean (0 findings) — this file's issues are all IA/interaction-design problems the mechanical detector isn't built to catch, not markup-level anti-patterns.

## Questions to Consider

1. The live data shows a real 7-section recurring agenda today — why does the editor still behave as if 2-3 sections is the ceiling?
2. Section delete asks for confirmation; point delete doesn't, for content that can hold just as much. Was that a deliberate risk call, or did point-delete just not get the same pass?
3. Three layout modes silently change what gets written into the minutes document — should the agenda editor show even a one-line preview of that, or is the separate Minutes panel enough discoverability on its own?
