---
target: left sidebar nav (AppSidebar.tsx)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-05T11-33-49Z
slug: src-components-appsidebar-tsx
---
Method: dual-agent (A: a9598671c51de9b5e · B: acb437992e758f8b2)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Active pill + teal rail + tooltip show location clearly; badge counts pop in with no loading indicator |
| 2 | Match System / Real World | 3 | Ministry vocabulary correct throughout, but `CalendarDays` icon covers two unrelated concepts |
| 3 | User Control and Freedom | 3 | Collapse/expand + ⌘/Ctrl+B solid; zero control over the 10-item list's order or visibility beyond activate/deactivate |
| 4 | Consistency and Standards | 3 | Pill/radius/shadow language matches DESIGN.md tokens throughout; icon reuse is the one real inconsistency |
| 5 | Error Prevention | 3 | `loadRecurringSidebarMeetings` defensively try/catches malformed localStorage; nothing destructive lives in the nav |
| 6 | Recognition Rather Than Recall | 2 | 10 flat top-level items plus 3 duplicated icon pairs/triples force recall over recognition |
| 7 | Flexibility and Efficiency | 2 | Keyboard toggle exists; no search/command-palette or pinning for a 10+7 item tree traversed daily |
| 8 | Aesthetic and Minimalist Design | 2 | The heuristic the brand is built around, and the nav is the densest surface in the app: 10 sections + alpha banner + module-upsell block + footer, all stacked in one rail |
| 9 | Error Recovery | 2 | Badge-count fetch has no `.catch` — a failed query silently omits the badge with zero signal |
| 10 | Help and Documentation | 1 | No help/support entry point anywhere in the sidebar |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment:** The token application (ink-charcoal gradient rail, single teal accent, generous radii, tooltip-on-collapse, the two-tier active-state system) is genuinely ACTSIX-flavored and matches DESIGN.md precisely. But the *structure* is stock shadcn-sidebar with ministry nouns dropped in — strip the color tokens and it's Linear/Vercel/any-SaaS-dashboard nav. The bigger gap: the *information architecture* itself — 10 flat top-level entries plus a 7-item Tasks submenu, no grouping — directly contradicts the product's own "quiet workroom" / "calm over busy" principle. Theming is specific; density decisions are generic-dashboard defaults, not "the quiet workroom" applied to IA.

**Deterministic scan:** `detect.mjs` exit code 2, 6 findings, all in `src/index.css`, none in `AppSidebar.tsx` or `sidebar.tsx`. Of those 6: the font/Montserrat findings (lines 1) are file-level, not sidebar-specific. The one legitimate in-scope hit is `#171714` inside `--gradient-sidebar` (line 124) — a raw hex literal (paired with `#1E1E1B`, which the detector didn't flag). **The four radius findings (429, 443, 464, 469) are false positives** on two counts: they're in unrelated shared classes (`.actsix-segmented-item`, `.actsix-view-tab`, `.actsix-interactive-tile/row`), not sidebar code, and the detector mis-parsed `calc(var(--radius-x) - Y)` expressions — resolved, all four values land exactly on documented DESIGN.md tokens (8px/12px/14px/14px).

Manual scan (since the detector doesn't check these) found what the LLM review's file citations didn't fully quantify: **3 interactive touch targets under 44px** (header collapse toggle at 28×28/32×32, and the submenu chevron at 40×40), and **3 raw color literals** (1 `rgba(255,255,255,0.42)` in an `AppSidebar.tsx` shadow, 2 hex values in `--gradient-sidebar`). Focus-ring coverage is otherwise excellent — 8 of 9 interactive elements carry `focus-visible:` directly; the 9th inherits it via a Radix `Slot` merge, unconfirmable by static scan but very likely present in the rendered DOM.

**Browser visualization:** unavailable — no browser automation tool exposed this session. CLI scan + manual code inspection only.

## Overall Impression

The system-level craft is real: tokens, focus rings, contrast floors, and the two-tier active-state pattern all match DESIGN.md exactly, and the file itself is clean of drift per the detector. But the sidebar has grown into the busiest surface in an app whose entire brand promise is calm — 10 ungrouped top-level modules, a 7-item submenu, an alpha-mode banner, and a module-upsell block all compete in one rail. The single biggest opportunity: group the flat list and get Tasks' submenu under control before touching anything else. Everything else here is real but secondary to that.

## What's Working

- **AppSidebar.tsx:444-447 & 494-496** — the two-tier active state (ambient teal wash on the parent row, strong light pill on the exact leaf) is implemented exactly as DESIGN.md prescribes — code and spec matching precisely is rare.
- **AppSidebar.tsx:411-437** — collapsed-state teal rail + solid-fill icon + combined tooltip (`"Section · Leaf"`) is a thoughtful, on-spec answer to "where am I" without needing labels.
- **src/index.css scrollbar block** — the dark-sidebar scrollbar restyle (thin, tinted, low-opacity) is a small correct detail most teams skip.
- Focus-ring discipline across the file (8/9 interactive elements carry their own `focus-visible:` ring) is genuinely above the usual bar.

## Priority Issues

**[P0] Flat 10-item top-level nav with a 7-item submenu contradicts "calm over busy"**
- **Why it matters:** `navSections` (AppSidebar.tsx:91-201) lists 10 ungrouped top-level entries; expanding Tasks (108-116) surfaces 7 simultaneous children plus a conditional recurring-meetings sub-list. This blows past the cognitive-load guidance (≤5 top-level, ≤4 siblings per decision point) and directly undercuts the product's stated "Thursday-afternoon test" and "Calm over busy" principle — the nav itself becomes the busy thing a stressed leader has to parse.
- **Fix:** Group top-level sections under labels (e.g. Ministry Work / Planning / Admin) via `SidebarGroupLabel`, and move Tasks' low-frequency children (Recurring, Weekly Review) behind a secondary affordance so the default-visible sibling count drops to ≤4-5.
- **Suggested command:** `/impeccable layout`

**[P1] Icon reuse breaks Recognition Rather Than Recall**
- **Why it matters:** `CalendarDays` is used for both Meetings (140) and Calendar (165/169) and again for Services (156); `FolderKanban` for both Groups (131) and Projects (111); `Users` for People (122), Teams (157), and Workspace settings (198). In collapsed icon-only mode this is the *only* differentiator between sections — a scanning user can't tell Meetings from Calendar at a glance.
- **Fix:** Give every top-level module a unique lucide icon; reserve near-duplicates for sub-items only, where the label is always visible.
- **Suggested command:** `/impeccable layout`

**[P1] Three interactive controls sit below the 44px touch-target floor**
- **Why it matters:** Header collapse/expand toggle is 28×28px collapsed / 32×32px expanded (AppSidebar.tsx:377-378), and the submenu chevron toggle is effectively 40×40px (461-464). These are primary, frequently-used controls (not decorative), which makes this worse than the earlier collapsed-icon-target fix already applied elsewhere in this file — the same gap remains on the two controls a user touches most often.
- **Fix:** Bump both to 44×44px, matching the standard already applied to the collapsed section icons.
- **Suggested command:** `/impeccable adapt`

**[P2] Badge-count fetch has no error or stale-data signal**
- **Why it matters:** `counts` starts as `{}` (213) and is populated by an unguarded `Promise.all` (295-321) with no `.catch` — a failed Supabase call silently leaves that badge absent. A leader relying on the Inbox badge to know "do I have new items" gets no signal the count is stale/unknown vs. genuinely zero. Violates Nielsen #9.
- **Fix:** Track a per-key error/loading state and render a neutral placeholder (e.g. a dash) instead of silently omitting the badge.
- **Suggested command:** `/impeccable harden`

**[P3] Promotional/system chrome injected into the primary nav path**
- **Why it matters:** The alpha-mode banner (393-396) and the "Available Modules… Activate" block (565-590) both live inside the same nav group as working navigation, competing for attention. This reads as product-led-growth chrome sitting inside a workspace tool, in tension with the "helpful ministry assistant, never enterprise-software tone" voice commitment and the "never a wall of chrome" density principle.
- **Fix:** Move module activation into Settings/Workspace, where it's a deliberate action rather than ambient nav noise.
- **Suggested command:** `/impeccable distill`

## Persona Red Flags

**Jordan (first-timer):** Lands on a flat, unlabeled 10-item list with no section headers or descriptive subtext, plus three icon look-alikes (CalendarDays ×2, FolderKanban ×2, Users ×3) to disambiguate with zero context. Nothing helps a brand-new user guess what "Service Planner" vs. "Sermon Hub" vs. "Training" contain before clicking in.

**Riley (stress-tester / the Thursday-afternoon persona):** Expanding Tasks to find "Next Actions" surfaces 7 stacked links at once plus a conditional "No recurring meetings yet" line; the alpha banner can appear above the nav in whatever release mode is active, adding one more colored block exactly when this persona needs the fewest things to parse.

**Sam (accessibility-dependent):** Focus-ring coverage is genuinely good throughout. Two flags: the "Available Modules" row (575-585) is a single `NavLink` wrapping text that visually mimics a separate "Activate" button — for a screen-reader user this reads as one link with a trailing label, ambiguous about what happens on activation vs. navigation. Separately, the header collapse toggle (28-32px) and submenu chevron (40px) fall under the 44px target Sam's motor-accessibility needs assume.

## Minor Observations

- Nested Tasks sub-items drop to 12px text / 3×3px icons — the densest cluster in the file, in tension with DESIGN.md's own "Weight-Not-Size Rule" (prefer weight over shrinking for hierarchy in dense UI).
- Three raw color literals live in sidebar code outside the token system: `rgba(255,255,255,0.42)` in an `AppSidebar.tsx` shadow (~line 550) and two hex values (`#1E1E1B`, `#171714`) inside `--gradient-sidebar` (index.css:124). Low risk since the sidebar is always dark, but worth tokenizing for consistency with the rest of the shadow/color system.
- The Settings section is the only one visually separated by a top border — an implicit "these are different" signal not extended to any other logical grouping, making its singularity look accidental rather than intentional.
- `renderBadge` sets `text-sidebar-foreground` on `bg-brand-teal/15` with no documented contrast check against that specific pairing — worth a spot-check now that the color was changed from `brand-teal-bright` in a prior pass.

## Questions to Consider

1. If "calm over busy" is binding, why does the nav itself carry more simultaneous visible options (10 top-level, up to 7 nested) than any content page the design system describes?
2. The two-tier active-state system is elegant once learned — has anyone verified a first-time user infers "teal wash = module, white pill = exact page" without being told, or is this currently self-documenting only to the team that built it?
3. Is "Available Modules / Activate" actually a navigation concern, or product-led-growth chrome that ended up in the nav by default rather than by design decision?
