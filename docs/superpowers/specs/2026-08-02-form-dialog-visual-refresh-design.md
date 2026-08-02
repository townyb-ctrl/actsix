# Form & Dialog Visual Refresh — Design

Date: 2026-08-02
Status: Approved for planning

## Problem

Three form surfaces in the Projects feature — the project editor, the section
editor, and the inline add-task row — look like they come from three different
products. The cause is structural, not cosmetic:

1. **Three modal implementations.** `src/components/ui/dialog.tsx` (Radix) exists
   but neither project dialog uses it. `ProjectEditorModal.tsx:56` hand-rolls an
   overlay at `bg-brand-ink/35`; the section editor at
   `ProjectDetailPage.tsx:1254` hand-rolls another at `/45`. Different scrims,
   different max-widths, and neither has a focus trap, Escape handling, or
   background scroll lock.
2. **Inconsistent primary action.** The section dialog's save is solid teal
   (`actsix-btn-primary`); the project modal's save is `actsix-btn-soft` — a pale
   outline, making the primary action the weakest button on screen. This
   contradicts "one obvious primary action" in `PRODUCT_GUIDE.md`.
3. **Boxes inside boxes.** Every field in the project modal sits in a
   `rounded-lg border border-border/70 bg-background/45` wrapper
   (`ProjectEditorModal.tsx` lines 88, 104, 117, 143, 156, 172, 220, 236). That is
   a bordered panel, inside a modal, holding a bordered input — three nested
   containers per field, all in adjacent beiges.
4. **Checkboxes disguised as inputs.** "Add reminder to calendar"
   (`ProjectEditorModal.tsx:158`) and "This project is an event" are styled as
   full-width bordered field boxes to line up with the date picker, so they read
   as controls that hold a value.
5. **Ragged field metrics in the section dialog.** Its `<select>` elements are
   `h-11 rounded-md` (`ProjectDetailPage.tsx:1300`, `:1324`) while its `<Input>`s
   fall through to the base `h-10 rounded-[var(--radius-control)]`. Different
   heights, different radii, same row.
6. **Redundant dismiss affordances.** The section dialog has a `Close` outline
   pill in the header *and* a `Cancel` in the footer. Its save button carries a
   `+` icon even when editing an existing section.
7. **Shouty labels.** `label-eyebrow` (uppercase, `tracking-[0.16em]`, bold) is
   applied to all eleven field labels in the project modal.

## Goals

- One shared dialog shell so these surfaces cannot drift apart again, and so
  future dialogs inherit correct behavior by default.
- One field vocabulary with a single source of truth for control metrics.
- Visibly calmer forms: fewer containers, clearer hierarchy, one obvious primary
  action per dialog.
- Close the accessibility gaps (focus trap, Escape, scroll lock, label wiring)
  that the hand-rolled overlays never had.

## Non-goals

- Refitting `TaskEditorModal`, `QuickCaptureDialog`, `RecurringTaskModal`,
  `WidgetLibraryModal`, `WidgetSettingsModal`, or the inline add-collaborator
  form. They adopt `FormDialog` in a follow-up.
- A custom date picker. See "Known limitation" below.
- Any change to form behavior, validation, persistence, or data flow. This is a
  presentation-layer change; every `onChange`/`onSave` contract stays as-is.
- Changing design tokens in `src/index.css`. The refresh composes existing
  tokens; the only CSS addition is the date-indicator rule in "Known limitation".

## Design

### 1. `FormDialog` — `src/components/ui/form-dialog.tsx` (new)

Wraps the existing Radix `Dialog` primitives rather than adding a fourth
hand-rolled overlay. Radix supplies the focus trap, Escape, scroll lock, and
`aria-labelledby`/`aria-describedby` wiring that the current implementations
lack.

```tsx
type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";   // default "md"
  footer?: React.ReactNode;
  children: React.ReactNode;
};
```

Structure:

- **Header** — eyebrow / title / description, plus the single `X` close already
  built into `DialogContent`. No secondary "Close" control; `Cancel` lives in the
  footer.
- **Body** — `flex-1 min-h-0 overflow-y-auto`, with a hairline top and bottom
  border so scrollable content visibly continues under the footer.
- **Footer** — sticky, `bg-card` (not a translucent beige, which is why the
  current footers read as a different material from the body). Layout:
  destructive/contextual slot left, `Cancel` + primary right.
- **Sizes** — `sm` → `max-w-md`, `md` → `max-w-lg`, `lg` → `max-w-2xl`.
- **Mobile** — bottom sheet via responsive classes on `DialogContent`
  (`items-end`, full width, `rounded-b-none` below `sm`), matching today's
  behavior. Not a `Drawer` swap; that would be a behavioral change beyond this
  scope.

**Primary-action rule:** the primary button in a `FormDialog` footer is always
`actsix-btn-primary` (solid teal). This is the rule that fixes problem 2, and it
is documented in the component's doc comment so the next dialog inherits it.

`FormDialog` renders the shell only. It does not own form state, submission, or
button wiring; callers pass their own footer nodes.

### 2. Field primitives — `src/components/ui/field.tsx` (new)

- **`fieldControlClass`** — one exported class string applied to `Input`, native
  `<select>`, and `<textarea>` alike:
  `h-11 rounded-[var(--radius-control)] border-border/70 bg-background` plus the
  teal focus treatment already used at `ProjectEditorModal.tsx:125`. This is the
  single source of truth that closes problem 5. `<textarea>` overrides height
  only.
- **`<Field label hint htmlFor>`** — sentence-case `text-sm font-semibold` label,
  the control as children, optional `text-xs text-muted-foreground` hint. No
  border, no background. This removes the per-field wrapper (problem 3).
- **`<FieldGroup title>`** — `label-eyebrow` section heading, `space-y-4` body,
  separated from the previous group by whitespace and a hairline `border-t`.
  Structure comes from rhythm, not nested borders.
- **`<FieldRow>`** — `grid gap-4 sm:grid-cols-2 items-start`. `items-start` is
  what stops a hint under one column from dragging the other column's control out
  of alignment.
- **`<CheckboxField label checked onCheckedChange>`** — a real checkbox row: a
  `h-4 w-4 accent-brand-teal` input and its label, no bordered container. Fixes
  problem 4.

**Label casing:** `label-eyebrow` is retained for `FieldGroup` section headings
and dropped for individual field labels, which become sentence case (problem 7).

### 3. `ProjectEditorModal` refit

`src/features/projects/components/ProjectEditorModal.tsx`

- Rebuilt on `FormDialog size="lg"` (down from `max-w-3xl`, too wide for a form
  this short).
- Three `FieldGroup`s: **Project identity**, **Schedule**, **Notes & people**.
- All eight per-field bordered wrappers removed.
- Both checkboxes become `CheckboxField`.
- The "Advanced" section is dissolved: the `Created:` date becomes quiet
  `text-xs text-muted-foreground` in the footer's left slot, and `Delete project`
  becomes a destructive text button beside it — visually separated from the save
  cluster, per `PRODUCT_GUIDE.md`.
- Save changes from `actsix-btn-soft` to `actsix-btn-primary`.
- The component keeps its current props exactly. It currently renders `null` when
  `project` is falsy; under `FormDialog` that becomes
  `open={Boolean(project)}`, with `onOpenChange` calling the existing `onClose`.

### 4. Section editor extraction + refit

New: `src/features/projects/components/ProjectSectionEditorModal.tsx`

The section editor is currently 115 lines of JSX inline at
`ProjectDetailPage.tsx:1253-1367`, inside a ~1400-line page. That inlining is why
it drifted from the project modal, so extraction is part of the fix, not
incidental refactoring.

Props (mirroring the state already in the page at lines 190-191, 367, 605):

```tsx
type ProjectSectionEditorModalProps = {
  section: Partial<ProjectSection> | null;
  saving: boolean;
  assignablePeople: PersonOption[];
  onChange: (section: Partial<ProjectSection>) => void;
  onClose: () => void;
  onSave: () => void;
};
```

`ProjectDetailPage` keeps `editingSection`, `savingSection`, `saveSection`, and
`assignableProjectPeople` unchanged and passes them down. No state moves.

The `ProjectSection` type is currently declared locally at
`ProjectDetailPage.tsx:65`. It moves to the new modal file and is imported back
into the page, so there stays exactly one definition.

Refit details:

- `FormDialog size="md"`.
- The header `Close` pill is removed; the `X` and the footer `Cancel` remain.
- The save button's icon becomes `Plus` when adding and `Save` when editing,
  matching its existing label logic.
- Both `<select>`s and both `<Input>`s use `fieldControlClass`.
- Leader/Status become a `FieldRow`, so the Leader hint no longer misaligns the
  Status column.

### 5. `ProjectAddTaskRow` refit

`src/features/projects/components/ProjectAddTaskRow.tsx`

Stays inline — it is not a dialog and should not become one.

- The open-state container moves from `bg-background` to `bg-card` with
  `border-border/70`, so it stops reading as a tan slab against the task pane.
- Title input on its own row; assignee / date / actions on the second row, as
  today.
- The ghost `Cancel` text button becomes an `X` icon button at the row's end, so
  the cluster is one primary plus one dismiss rather than two competing text
  buttons.
- Controls adopt `fieldControlClass` for height and radius parity with the
  dialogs.
- The collapsed-state "Add task" trigger is unchanged.

### Known limitation: native date inputs

The `yyyy/mm/dd` placeholder in `<input type="date">` is native browser
rendering and cannot be changed with CSS. Scope of this work:

- Style `::-webkit-calendar-picker-indicator` in `src/index.css` (brand color,
  consistent sizing) so the picker affordance stops reading as default Chrome
  chrome.
- The placeholder format itself stays. Removing it requires a custom date-picker
  component, which is separate work and explicitly out of scope here.

## Testing

No behavior changes, so no new behavioral tests. Verification is:

- `npx tsc -p tsconfig.app.json --noEmit` — clean.
- `npm run lint` — clean.
- `npm test` — existing suites pass, notably
  `src/features/projects/components/ProjectTaskPane.test.tsx`, which renders
  `ProjectAddTaskRow`. Its assertions target the `Add task` trigger and the
  `Add task to {section}...` placeholder (lines 98-131), neither of which this
  change touches, so it should pass unmodified.
- `npm run build` — succeeds.
- `npm run dev` manual pass, since this is a purely visual change and the build
  cannot catch a regression here. Check, on desktop and at mobile width:
  project editor, section editor (both add and edit), add-task row; empty and
  populated states; Escape and scrim-click dismissal; keyboard tab order staying
  inside the dialog; no console errors.

## Risks

- `FormDialog` swaps the hand-rolled overlays for Radix portals. Stacking against
  existing overlays (e.g. the add-collaborator form still hand-rolled in
  `ProjectDetailPage`) needs a visual check if both can be open at once.
- Extracting the section editor touches a large page file. The extraction is
  mechanical — move JSX, pass existing state as props — with no state relocation,
  which keeps the diff reviewable.
