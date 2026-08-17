---
target: venue hire detail page
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-17T06-21-04Z
slug: src-features-venues-pages-venuehiredetailpage-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The three live facts on this hire (R 3 250 outstanding, nobody to call on the day, walkthrough incomplete) raise zero rail badges and appear nowhere on the Overview |
| 2 | Match System / Real World | 3 | Ministry-native voice throughout, but `-R 600,00 paid` and `Net -R 600,00` describe a refund in language no bookkeeper uses |
| 3 | User Control and Freedom | 1 | Typing the security plan and switching sections silently discards it; quote status commits instantly with no undo; `?section=` is stripped on hard load |
| 4 | Consistency and Standards | 2 | The rail behaves as tabs but is marked up as `nav` + buttons; DESIGN.md's row rule, tabular rule and three-teal rule are each broken on this page |
| 5 | Error Prevention | 1 | "Mark as Accepted" is one unconfirmed click on a financial state; "Turn off" on the hirer link has no confirm; nothing guards unsaved text |
| 6 | Recognition Rather Than Recall | 3 | The Overview is the right instinct and works, but omits the two facts you most need, so you still have to check On the day |
| 7 | Flexibility and Efficiency | 2 | 11 tab stops to reach 5 destinations; no arrow-key rail; no action reachable from the landing section |
| 8 | Aesthetic and Minimalist Design | 3 | Genuinely calm and well-set; loses to card-on-card stacking and ~350px of dead ground under a sparse Overview at 1440 |
| 9 | Error Recovery | 1 | All 14 read hooks expose `error`; the page destructures none. A failed query renders as "No open incidents." |
| 10 | Help and Documentation | 3 | The inline honesty notes are the best writing in the module; the Overview teaches nothing about what to do next |
| **Total** | | **21/40** | **Acceptable — significant work before users are happy** |

## Design Specificity Verdict

**The words are ACTSIX. The layout is anyone's.**

The content could not be lifted into another product. The five buckets are named the way a church admin talks (Dates, Money, Plan, On the day, Afterwards), the Church diary panel checks the hire against the church's own calendar, Afterwards is built around a bond walkthrough, and the panels volunteer their own limits: "ACTSIX does not send it, email it to the hirer yourself." Rands, en-ZA dates, car guards as a staffing role. Domain-literate.

The chrome is not. Every panel is a white rounded shadcn Card with a 16px semibold title left and controls right, including the Overview cards. That is the most-copied dashboard shell on the web, and it contradicts the project's own system: DESIGN.md commits to "rows edge to edge on hairline dividers, never as separated cards," while this page nests cards inside cards inside cards. The one Studio move that would make it unmistakably ACTSIX, the instrument-panel row rhythm with mono tabular figures in a column, appears once (`R 2 650,00`) and not even on the `R 3 250,00 outstanding` directly beneath it.

**Deterministic scan**: `detect.mjs` over all four files returned `[]`, exit 0. Zero rules fired. Worth noting honestly: the detector caught nothing that either the browser evidence or the design review found. It reads HTML/CSS slop patterns; design-system drift expressed as correctly-tokenised shadcn Cards is invisible to it. A clean detector run is not a clean page.

**Visual overlays**: none. Injection preflight succeeded but no overlay was needed; all evidence came from measured `evaluate_script` in a headed tab. Two screenshots the evidence pass left in the repo root were deleted.

## Overall Impression

The thinking on this page is better than the execution. The section rail, the badge discipline (count only what wants a person, hide at zero), the fixed card order, and the inline honesty notes are real product judgment that most teams never reach. Then a phone user cannot see 18% of it, a dropped network call reads as good news, and typing three paragraphs into the security plan loses them.

The single biggest opportunity: **the Overview is a summary you cannot yet trust.** Three of its cards disagree with the panels behind them on this one seeded hire. Fix the trust and the rail becomes the feature; leave it and people click all five sections anyway, which is the exact cost the rail was built to remove.

## What's Working

1. **Badge discipline.** `VenueHireSectionRail.tsx:6-11` counts "things still wanting a person's attention," never what merely exists, and hides at zero. The Overview deliberately carries no badge because the four section badges already count the same problems. Most products would have lit a fifth number. This is the difference between a rail you keep reading and one you learn to ignore.

2. **The inline honesty notes.** "The hirer can only accept once the quote is marked Sent." "Printed, signed on paper, recorded here. ACTSIX does not do e-signature." "Starts from your standard wording, set under Spaces. Editing here changes this hire only." Each kills a specific wrong assumption at the moment it would form. Expensive product knowledge, written like a colleague.

3. **Whole-card hit targets in fixed order.** The Overview grid mirrors the rail and refuses to re-sort by urgency, so Money is always second. Position constancy beats urgency-sorting for someone opening twenty hires a week, and the whole card is the button, not a "View" link in the corner.

## Priority Issues

**[P0] A failed query is indistinguishable from good news**
- **Why it matters**: `VenueHireDetailPage.tsx:145-176` calls fourteen query hooks, all `retry: false`, all exposing `error`. The page destructures none of them. If `useIncidents` fails, the Overview says "No open incidents." If `usePayments` fails, the hire reads as settled. DESIGN.md names this exact scenario as "the most dangerous thing this app can do," and here it lands on a safety panel and a payments ledger.
- **Fix**: Destructure `error` from each hook, collect the first truthy one, and render the Studio rose-left-rule block above the pane: "We couldn't load this hire's payments. This is not showing real data." Pass `error` into each panel so a partial failure scopes to its own card.
- **Suggested command**: `/impeccable harden`

**[P0] The page is clipped and unreachable on a phone**
- **Why it matters**: At 390px every Overview card runs `left: 15 → right: 474`, 84px past the viewport, and it is cut off rather than scrollable. Both assessments landed on the same root cause independently: the rail wrapper `<div className="lg:sticky lg:top-4">` (`VenueHireSectionRail.tsx:30`) has `min-width: auto`, so its six `shrink-0` chips (431.8px + gaps = 459.2px) set the min-content of the page's auto grid column. Hiding the rail collapses the column to 361px. The nav's own `overflow-x-auto` cannot rescue it, and `nav.scrollWidth === nav.clientWidth === 457` means the scroller believes it fits. Invisible on phones: the arrow on all five cards, the "No clashes" badge, the Hire card's values, and the Afterwards chip. Venue hire is the module most likely to be used standing in a hall.
- **Fix**: `min-w-0` on the rail wrapper, `w-full` on the nav. Add a 390px regression assert that `card.getBoundingClientRect().right <= innerWidth`.
- **Suggested command**: `/impeccable adapt`

**[P1] The Overview contradicts the panels it summarises**
- **Why it matters**: Three verified disagreements on one seeded hire. (a) The "On the day" card reads only incidents (`VenueHireOverviewPanel.tsx:182-197`) and says "No open incidents." while the panel behind it opens with "Nobody is listed to call on the day" and the sidebar simultaneously shows a name and number. (b) The Afterwards card is never passed `walkthroughs`, so a bond walkthrough marked Incomplete summarises as "Nothing recorded yet." (c) `VenueHireDetailPage.tsx:294` gates the Money badge on `quote_status === "Accepted"`, so R 3 250 outstanding against a Draft quote raises nothing. Commit 094a0aab was titled "make the Overview cards agree with the panels they summarise"; these three still disagree, and two are about a bond and a phone number.
- **Fix**: Count `contacts.length === 0` in the On the day card and its rail badge. Pass `walkthroughs` into Afterwards. Change the Money badge to `outstanding > 0 && quote_status !== "Declined"`, and surface "Contract signed but the quote is still a draft" as its own line.
- **Suggested command**: `/impeccable harden`

**[P1] Section switching silently destroys typed work**
- **Why it matters**: Verified in the browser: type into "Who gets in, and how", click Dates, click back, empty, no warning. Same for the contract terms textarea. `VenueHireDetailPage.tsx:347-531` mounts sections conditionally, so switching unmounts local form state. This hits the two longest free-text fields on the page and violates PRODUCT.md's "Never punish mistakes" outright.
- **Fix**: Save on blur, or lift the two textareas' drafts into the page and keep them mounted. Not `beforeunload` — the loss is on an in-page switch.
- **Suggested command**: `/impeccable harden`

**[P1] The Overview is invisible to a screen reader as structure**
- **Why it matters**: `CardTitle` renders `h3`, but `OverviewCard` wraps the whole Card in a `<button>` (`VenueHireOverviewPanel.tsx:53-67`), and a button takes its name from content. Chrome's a11y tree exposes zero headings in the main pane; the document jumps `h1` → `h3` with no `h2` anywhere. The Money card announces as one unbroken string: "Money R 2 650,00 -R 600,00 paid · R 3 250,00 outstanding Quote draft · contract signed," with no indication it navigates. The rail is `<nav>` containing buttons that switch in-page content, so a screen-reader user is told these are navigation and nothing announces the pane change. The paid meter is `role="presentation"`, so the ratio exists only in 4.19:1 grey text.
- **Fix**: Give each card a real heading outside the button, or move the button inside the card with an explicit `aria-label`. Make the rail a `role="tablist"` with `aria-selected`/`aria-controls` and roving arrow-key focus, or add `aria-live="polite"` to the pane. Give the meter `role="progressbar"` with `aria-valuenow`.
- **Suggested command**: `/impeccable audit`

**[P2] The Overview's content fails AA contrast**
- **Why it matters**: Both assessments measured it. `--st-ink-3` `#7E7C72` renders 4.19:1 on white panel and 3.71:1 on ground, across 21 text instances: "4 days · 2 bookings", "Revolve Hall", the paid/outstanding line, "Quote draft · contract signed", "No open incidents.", plus the eyebrow, the date span and every inactive rail tab. That is nearly all of the Overview's actual content. Ink-3 is defined in DESIGN.md as muted, a role for a suppressed label, not for the only statement of an outstanding balance.
- **Fix**: Move card body text to `--st-ink-2` (`#55534B`, ~7:1); reserve ink-3 for 10px uppercase labels. Zero layout change.
- **Suggested command**: `/impeccable polish`

**[P2] Negative payment data breaks three surfaces**
- **Why it matters**: `money.received` is `-600`, so `paidPercent` clamps to 0 and the meter renders 0×0 inside a full-width tan track that reads as *filled* at a glance. The Overview says "-R 600,00 paid", Payments says "Received -R 600,00", and the debrief says "Net -R 600,00" where net is documented as "money kept." Outstanding exceeds the quote. `venuePayments.ts:65` sums `payment.amount` raw with no sign convention.
- **Fix**: Decide the convention in `venuePayments.ts` (refunds negative, receipts positive) and render refunds as their own line: "R 600,00 refunded", never as negative paid.
- **Suggested command**: `/impeccable clarify`

## Persona Red Flags

**Sam (keyboard / screen reader)**: Zero headings in the main pane. Card names announce as one run-on string. The rail claims to be navigation but switches in-page content with no announcement. The progress meter is `role="presentation"`. Eight of thirteen Overview targets are under 44px (back link and Edit hire at 37.5px, rail tabs at 42px); the Plan section drops to 26.3px on "Add to this day" and "Remove", and 22.5px on the position role headers, which also concatenate as "Operations07:00–16:00" with no separator.

**Casey (distracted, mobile)**: Cannot see 18% of the page. The floating bottom nav covers the Quote panel's "Mark as Draft | Sent | Accepted | Declined" row entirely at 390px, and the page reserves no bottom padding for it. The Contacts card, the phone number for the person standing in the building, is the last element on the mobile page, roughly 2,000px below the fold.

**Riley (stress tester)**: A hard load of `?section=after` bounces through `/workspace-setup`, briefly rendering a secret-phrase form, and returns with the query string stripped, landing on Overview, while the code comment at `VenueHireDetailPage.tsx:128-132` documents the opposite intent. `spaceNames.join(", ")` on the Dates card is unclamped. `VenuePositionBoard` renders every day and position with no virtualisation, and `usePositionAssignments(positions.map(p => p.id))` builds a new array identity every render, keying a query on it.

**The Thursday-afternoon volunteer (project-specific)**: Fifteen minutes between a phone call and a school run, one job: has IFBB paid, and who do I phone on Saturday? The Overview gives her four money facts that cannot all be true, with no badge suggesting she should worry. The sidebar names Claude Sanders and a phone number; the On the day panel says nobody is listed. She starts typing the door plan, checks a start time, comes back, and it is gone. Nothing tells her who last touched this hire or when, so she cannot tell whether the pastor already sorted it this morning.

## Minor Observations

- The `<aside>` at `VenueHireDetailPage.tsx:539` is `static`, while the comment above it says "Always on screen, whichever section is open." It scrolls away on Money, Plan and On the day, the long sections. Add `lg:sticky lg:top-4` or delete the claim.
- Both `formatDate` helpers are duplicated verbatim between page (line 89) and panel (line 30).
- The Tabular Rule is applied to `money.charged` and nothing adjacent. The paid/outstanding line, "4 days · 2 bookings", and the Dates card's dates are all proportional.
- Three-teal budget on Plan: active rail pill + "Fully staffed" badge + one solid teal badge per position. A twelve-position hire lights fourteen teals.
- The Money meter uses `bg-brand-teal`; DESIGN.md assigns meter fills to Teal Dim `#2C7169`.
- The legacy HSL tokens land 1-2 hex steps off their Studio twins: `--primary` paints `#12403D` against `--st-accent` `#123F3C`, `--background` paints `#F3F1EC` against ground `#F4F2ED`. And `--brand-sage` `#6E7A62` has no palette entry at all, painting the Church diary icon.
- The "Hire" sidebar card carries Event type and Bookings, both already in the PageHeader subtitle and the Dates card. It is a divider with a badge on it.
- The feedback-avatar widget overlaps the page title on load at both widths.
- `VenuePositionBoard`'s empty state is the best-written on the page; the Overview's ("Nothing planned yet.", "Nothing recorded yet.") say nothing and offer no action, which PRODUCT_GUIDE requires of an empty state.

## Questions to Consider

1. If the Overview cannot act, why is it the landing section? The consequence is that the default screen of every hire is read-only and the most common Thursday job costs an extra click forever. Should each card carry the one action its section is most often opened for?
2. What is the rail badge actually counting? Unfilled roles and open incidents, but not an unsigned contract, an outstanding balance on a draft quote, a missing on-the-day contact, or an incomplete bond walkthrough. Those four are the ones that cost money or leave a building locked. Is "attention" defined by what is easy to count, or by what goes wrong?
3. Six sections, five cards, three sidebar panels, four stacked panels inside Money. Is the rail solving the complexity or hiding it? What would this page look like if the answer were fewer panels rather than a rail?
4. If a query fails, does the Church diary card still say "No clashes"?
5. DESIGN.md forbids separated cards for rows, and this page is built almost entirely from them. Is the Studio row rule wrong for a page like this, or is this page the reason the rule needs enforcing?
