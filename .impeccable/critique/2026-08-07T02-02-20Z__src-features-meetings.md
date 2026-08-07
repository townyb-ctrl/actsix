---
target: the meetings module
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 3
timestamp: 2026-08-07T02-02-20Z
slug: src-features-meetings
---
Method: dual-agent (A: design review · B: detector + mechanical evidence), run isolated and synthesized here.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Minutes save on blur with no toast, no timestamp, no dirty state — while every other mutation on the page toasts. A failed meeting fetch leaves "Loading meeting..." on screen forever (`MeetingDetailPage.tsx:897`). |
| 2 | Match System / Real World | 2 | Strong church nouns (chairperson, apologies, action points) undercut by schema leakage: "People scope", "folder source", `not_required`. Same value reads "Attended" as a button and "Attending" as a badge. |
| 3 | User Control and Freedom | 1 | No undo anywhere. Meeting delete is unconfirmed. Agenda save silently overwrites written minutes. All four hand-rolled modals discard drafts on dismiss with no warning; `grep dirty\|unsaved\|hasChanges` over the module returns 0. |
| 4 | Consistency and Standards | 1 | Four modal implementations coexist — Radix `Dialog` in two places, hand-rolled `fixed inset-0` overlays in four. `ConfirmDialog` guards recurring-series delete but not meeting delete. One empty state has a CTA, its sibling doesn't. |
| 5 | Error Prevention | 1 | Empty-title submit silently returns (`MeetingsPage.tsx:85`). `saveAgenda` writes `notes: generated` unconditionally. Regular-attendee chips delete on a single click with no confirm. |
| 6 | Recognition Rather Than Recall | 1 | The only route into people management is an unlabeled `MoreHorizontal` glyph. The empty state instructs the user to click **Edit People** — a button that does not exist on screen. |
| 7 | Flexibility and Efficiency | 1 | Action points can never be completed — `status: "Open"` is hardcoded on insert and nothing ever updates it. Recurring series can't be edited after creation. No bulk occurrence generation. |
| 8 | Aesthetic and Minimalist Design | 3 | The strongest area. The one-line count, the deliberately stacked-not-tabbed detail sidebar, and the collapsed-by-default format toolbar are all restraint applied on purpose. |
| 9 | Error Recovery | 2 | `friendlyError.ts` is a genuine asset — Postgres text never reaches the user. But toasts are the only channel, there's no inline recovery, and no not-found state on meeting detail. |
| 10 | Help and Documentation | 1 | Three tour steps, all on the list page, two of them highlighting nearly the same box. Nothing teaches agenda, minutes, attendance, or recurring — where all the difficulty is. |
| **Total** | | **15/40** | **Poor — core experience is lossy** |

15/40 is below the 20–32 band a real interface usually lands in, and it's deliberate. The module is not badly *drawn* — heuristic 8 scores well and the restraint is real. It's badly *finished*: the surface is calm while the mechanics behind it lose work, hide the primary action, and can't close the loop the page advertises.

## Design Specificity Verdict

**Authored vocabulary, generic interaction design.** A generic SaaS could ship ~85% of this by swapping four nouns.

**Genuinely ministry-specific.** The domain model is church-council language, not calendar-app language — chairperson, minute taker, apologies, attendance register. `MeetingAttendanceModal.tsx:5` offering *Apology* as a first-class status beside *Absent* is something Calendly would never model. `meetingAgenda.ts:119` generating a minutes skeleton with `Notes:` / `Decisions:` under every numbered agenda point is real institutional-minutes thinking, and it's the single most product-specific artifact in the module.

**Generic.** The interaction shape is list → detail → modal stack with CRUD parity across every entity. Nothing adapts to *when* it is: no past/upcoming split, no "this meeting is tomorrow", no "last meeting's open actions". The page counts "scheduled / unscheduled" — a database distinction, not a ministry one. A leader asks *what's coming up and what did we decide last time*; the page answers *how many rows have a non-null date*.

The module knows it's about church meetings. It doesn't know it's ACTSIX — status badges at `MeetingPeopleSection.tsx:70-90` use raw `amber-50/amber-700`, `rose-50/rose-700`, `slate-100/slate-700` instead of the parchment/sage/danger tokens DESIGN.md declares binding. At badge level it looks like default shadcn.

**Deterministic scan: clean, and that means less than it sounds.** `detect.mjs` returned `[]` / exit 0 on every pass — full scan, `--scope layout`, `--scope type`, per-file. Assessment B validated the engine isn't silently no-op by feeding it a bad probe (`bounce-easing` fired). But the same probe showed `z-[9999]`, `bg-[#ff0000]` and `text-[10px]` produce **no** findings in `.tsx` — the 60-rule set is a visual-slop detector aimed at HTML/CSS and browser mode, and on JSX it runs regex-only. **Clean here means "no slop signatures the regex engine can see in JSX", not "no problems."** Everything below that the detector missed is real.

**Visual overlays: none.** No browser automation tool is exposed in this session, and every meetings route sits behind Supabase auth with no session available. No dev server was started, no injection attempted, no screenshot exists. Rendered contrast, real reflow at 390px, and actual focus order are unverified — treat those specific claims as source-derived only.

## Overall Impression

The calm surface is real and earned. Underneath it, this module loses user work in four distinct ways, hides its own primary action behind an unlabeled glyph, and promises tracking it cannot deliver. The single biggest opportunity isn't visual — it's that **one screen in this module already does destructive UX correctly**, and nothing else copies it.

## What's Working

1. **`RecurringMeetingsPage.tsx:495` — the delete confirmation that answers the real question.** Not "are you sure?" but *"Existing meetings that were already created will not be deleted."* That one sentence removes the actual fear a leader has. It's the model the rest of the module should copy verbatim.

2. **`MeetingsPage.tsx:191` — three stat tiles deleted on purpose, reasoning left in the code.** A designer refusing a dashboard reflex, which makes the list the calmest screen here.

3. **`meetingAgenda.ts:119` + `meetingMinutes.ts:19` — agenda-to-minutes generation.** Does actual work for the user instead of offering a blank box, and encodes how church minutes are really kept. Sanitization was split into a reviewable pure module — good instinct.

## Priority Issues

### [P0] Saving an agenda destroys minutes already written
`MeetingDetailPage.tsx:509` — `saveAgenda` writes `notes: generated` unconditionally. Any minutes previously typed are overwritten with a blank skeleton.

**Why it matters:** the realistic sequence is *hold the meeting → write minutes → notice an agenda typo → fix it → save*. An hour of the governance record is gone, no undo, no confirmation. The button says "Save Agenda and Fill Minutes"; it does not say "and delete what you wrote."

**Fix:** only write `notes` when `meeting.notes` is empty. If notes exist, either append the agenda sections not already present, or gate on `ConfirmDialog` — "Replace the minutes you've written?". Rename the button to "Save Agenda" and make filling an explicit secondary action.
**Suggested command:** `/impeccable harden`

### [P0] Deleting a meeting has no confirmation
`MeetingDetailPage.tsx:985` — the menu item closes the menu and calls `deleteMeeting()` immediately, cascading `meeting_actions` and the minutes.

**Why it matters:** Delete sits directly under "Edit Meeting" in a narrow menu. A trackpad misclick is unrecoverable loss of a meeting record. PRODUCT.md: *"Never punish mistakes. Dangerous actions intentional, recovery easy."* This violates it as literally as possible — and `ConfirmDialog` is already used correctly in a sibling page.

**Fix:** wrap in the existing `ConfirmDialog`. Name the meeting and the count of action points that go with it.
**Suggested command:** `/impeccable harden`

### [P0] Minutes never confirm they saved, and only save on blur
`MeetingMinutesEditor.tsx:248` (`onBlur` → `onSave`) plus `saveMinutes` at `MeetingDetailPage.tsx:488`, which is the only mutation on the page with no success toast. No autosave, no timestamp, no dirty indicator.

**Why it matters:** minutes are the longest-form, highest-value, most-easily-lost content in the module. Twenty minutes of typing, then a closed lid or a crashed tab, loses everything — and even on success nothing says so. Every other action toasts; this asymmetry actively teaches the user that minutes aren't being saved.

**Fix:** debounced autosave (~2s idle) plus a `Saved 14:32` line in the card header. Keep blur-save as backstop.
**Suggested command:** `/impeccable harden`

### [P1] The primary "add people" action is invisible, and the empty state names a button that doesn't exist
`MeetingPeopleSection.tsx:341` — the only route into people management is an icon-only `MoreHorizontal` (accessible name "People actions"). The empty state at `:150` reads *"Click **Edit People** to add individuals, groups, or folders."* No element labeled "Edit People" is on screen; it's the first item inside that unlabeled ⋯.

**Why it matters:** a meeting without people can't have attendance, can't have a chairperson (leadership assignment is blocked until people exist), and can't assign action points. One hidden button gates three of the module's four jobs — and the instruction meant to rescue the confused user points at nothing.

**Fix:** put a visible `Add People` button in the card header beside the count badge; keep ⋯ for Attendance and Mark invites sent. Put the same button *in* the empty state instead of prose naming it.
**Suggested command:** `/impeccable clarify`

### [P1] Action points can never be completed
`MeetingDetailPage.tsx:764` hardcodes `status: "Open"` on insert. `MeetingActionsPanel.tsx:88` offers only a trash icon. Nothing in the codebase ever updates `meeting_actions.status`, and the table appears in no other module — not Tasks, not the dashboard.

**Why it matters:** the page header promises "track action points". The module can capture and delete them, with no concept of one being *done*. A leader's only way to clear a finished item is to delete it — destroying the record of it ever existing, the exact opposite of what minutes are for.

**Fix (minimum):** a checkbox per row toggling `Open`/`Done`, done items dimmed and sorted below. Surfacing them in Tasks is the proper fix and a bigger conversation.
**Suggested command:** `/impeccable shape`

### [P1] Meetings are private to their creator, while the series that generate them are shared
`meetings` has `user_id` and **no `workspace_id`** (`types.ts:360`), and `MeetingsPage.tsx:56` selects with no workspace filter. But `recurring_meeting_series` **is** workspace-shared per its migration.

**Why it matters:** the admin opens the shared weekly staff series, clicks "Create Meeting" on the next four occurrences — those insert with `user_id: user.id` and appear only in *her* Meetings list. The pastor sees an empty list beside a series claiming four occurrences exist. This is the largest product-fit break in the module and it's invisible until two people use it.

**Fix:** decide whether a meeting belongs to a person or to the church, then make the schema say so. This is a data-model decision, not a UI one.
**Suggested command:** `/impeccable shape`

## Persona Red Flags

**Jordan (Confused First-Timer)**
- Creates a meeting; the modal never closes — `createMeeting` (`MeetingsPage.tsx:106`) clears fields, toasts, reloads, and never calls `setAddOpen(false)`. Jordan sees a blank form, concludes it failed, clicks again. Two meetings.
- Submits an empty title: nothing happens. No error, no focus move, no red field (`MeetingsPage.tsx:85`).
- After creating, no navigation to the new meeting — must close the modal and find their own row in a date-ordered list.
- Told to click "Edit People". Scans the card. No such button.
- Looking for "Agenda"; it's filed inside a card titled "Meeting Minutes" (`MeetingMinutesEditor.tsx:122`).
- Five attendance statuses with no explanation of Apology vs Absent vs Not required — and one badge state (`unavailable`) can't be set from that modal at all.

**Riley (Deliberate Stress Tester)**
- `/meetings/not-a-real-id` → error toast, early return, `meeting` stays `null`, page renders "Loading meeting..." forever. `RecurringMeetingDetailPage.tsx:333` handles this case correctly — two sibling pages, two behaviors.
- Escape works in the two Radix modals, does nothing in the four hand-rolled `fixed inset-0` overlays (no focus trap, no key handler, no `role="dialog"`).
- Edits the agenda on a series-generated meeting: `serializeAgenda` writes only `type`/`sections`/`apologies`, silently stripping the `recurringSeriesId` and `peopleGroupId` stored in that same JSON blob. The meeting detaches from its series. Data destroyed by an unrelated action.
- Accepts an invite before the meeting → writes status `"attended"`. Now marked as having attended a meeting that hasn't happened. RSVP and attendance register are the same field.
- Cmd+Z in the minutes editor: `document.execCommand("undo")` against a `dangerouslySetInnerHTML` node React re-renders on every `notes` change.

**Casey (Distracted Mobile User)**
- `MeetingsPage.tsx:258` wraps the whole row in a `<Link>`, then nests two `<button>`s inside it at `:305`/`:315`. Invalid HTML; on a phone a slightly-off tap on "Copy Link" navigates away instead.
- Blur-only save plus a mobile keyboard: dismissing the keyboard, app-switching, or an incoming call — whether `onBlur` fires and the request completes before backgrounding is guaranteed nowhere.
- `RecurringMeetingDetailPage.tsx:605` renders regular attendees as chips identical to the read-only chips at `:419`, except these delete on a single tap. A thumb scroll that registers as a tap removes someone from every future meeting.
- 19 touch targets under 44px with no `min-h` counterpart, including the `h-6` Accept/Decline RSVP buttons at `MeetingDetailPage.tsx:1028`.

**Volunteer ministry admin (project persona — twice a week, laptop, between other jobs)**
- Her generated meetings are invisible to the pastor (see P1 workspace scoping).
- She types the leadership team into "Regular Attendees" and it evaporates: those names write to `meetings.attendees`, which `MeetingDetailPage.tsx:271` reads into `attendeesText` — consumed only by `savePeople`, **a function called from nowhere**. Verified: `grep savePeople src/` returns the definition and no callers. Orphaned by the recent decomposition.
- The sidebar tells her she has no recurring meetings on the same visit she created three: `AppSidebar.tsx:77` still reads `localStorage["actsix_recurring_meetings"]`, a key nothing in `src/` writes since the Supabase migration. That list is now permanently empty for every user.
- Twice-weekly use never builds muscle memory for an unlabeled ⋯. Recognition-over-recall matters more for her than anyone.
- Resuming after four days, nothing distinguishes generated from pending except scanning 12 rows for "Open Meeting" vs "Create Meeting".

## Minor Observations

Mechanical findings the detector could not see (Assessment B, manually spot-checked):

| Finding | Count | Example |
|---|---|---|
| Inputs with no programmatic label | 17 | `MeetingsPage.tsx:361-401` (5 orphan `<label>`s, no `htmlFor`) |
| Touch targets < 44px, no `min-h` guard | 19 | `MeetingDetailPage.tsx:1028` (`h-6` RSVP) |
| `<button>` missing `type="button"` in a form | 9 | `MeetingEditModal.tsx:95` |
| Icon-only buttons with no accessible name | 6 | `MeetingActionsPanel.tsx:62` (the `+` submit) |
| Hand-rolled modals, no `role="dialog"`/focus trap/Escape | 4 | `MeetingsPage.tsx:335` |
| Destructive actions with no confirmation | 4 sites | `MeetingDetailPage.tsx:990` |
| Raw Tailwind palette bypassing tokens | 18 utilities | `MeetingPeopleSection.tsx:70-90` |

Clean on `alert()`/`confirm()`, on `onClick`-on-`div`, and on color-only state signaling — every status variant carries a text label.

Smaller notes:
- `MeetingsPage.tsx:348` + `:414` — a "Close" button top-right *and* a "Cancel" bottom-left of the same modal. Two words, one action.
- `MeetingActionsPanel.tsx:84` renders the raw ISO date (`2026-08-14`) while every other date goes through `formatDate`.
- `meeting_time.slice(0, 5)` prints 24-hour time while dates use `toLocaleDateString`. Half-localized.
- `MeetingsPage.tsx:23` uses `new Date(date)` (UTC-parsed, can render the previous day in western timezones); `meetingAgenda.ts:112` correctly appends `T00:00:00`. Three date formatters, two of them right.
- `MeetingSourceCombobox.tsx` has no keyboard navigation — no arrow keys, no Enter-to-select, no `role="listbox"`. It's a div of buttons. Also uses `Math.random()` for an element id where `useId()` is the codebase convention.
- `MeetingDetailPage.tsx:189` — the invite template ships a literal `{{username}}` placeholder into a user-editable textarea with no substitution logic anywhere.
- `MeetingDetailPage.tsx:482` tells a pastor "Make sure the local transcriber server is running."
- `MeetingPeopleSection.tsx:281` — "This workflow currently only marks invite status as sent." A developer's changelog note shipped as UI copy.
- `MeetingMinutesEditor.tsx:146` — 11 formatting controls including a 6-option font select with Courier New and Arial. Directly contradicts "opinionated over configurable".
- `MeetingAttendanceModal.tsx:65` — 5 status buttons per person. A 12-person elders meeting renders 60 identical-weight buttons in one scroll container.
- `RecurringMeetingDetailPage.tsx:495` — 12 to 60 occurrence rows, each carrying a full-strength teal primary button. Up to 60 elements all saying "act here", against DESIGN.md's One Accent Rule.

**Cognitive load: 5 of 8 checks fail.** Single focus (nine competing concerns on the detail page), grouping (attendance reachable from three unrelated doors), one-thing-at-a-time (the 88vh Edit People sheet does six jobs), minimal choices, and working memory all fail. Chunking, visual hierarchy, and progressive disclosure pass — though disclosure is inverted: the format toolbar is correctly hidden while "add people" is the thing that's buried.

## Questions to Consider

1. **Why does a meeting belong to a person and not to the church?** `meetings` has `user_id` and no `workspace_id`, while series, people, and projects are all workspace-scoped. Was that decided, or inherited?
2. **What is the difference between "Attending" and "Attended", and does the product know?** One field is doing RSVP-before and register-after. If she marks the register on Thursday, has she overwritten the RSVPs — and can she ever tell who said yes but didn't come?
3. **If an action point can't be completed, is it an action point or a note?** And if it can be, why does it live in Meetings rather than Tasks — the module PRODUCT.md says gets depth over breadth?
4. **What is the agenda, as an object the user can see?** It exists only as a modal you edit and a skeleton it stamps into the minutes. Nobody can print it, send it, or read it before the meeting. Is "agenda" a feature or a generator?
5. **The one screen that clearly states the consequence of a destructive action is the recurring-series delete.** What would it take to make that the default everywhere — and why did it end up being the exception?
