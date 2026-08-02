# Form & Dialog Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three divergent, hand-rolled dialog/field implementations in the Projects feature (project editor, section editor, inline add-task row) with one shared `FormDialog` shell and one field vocabulary, fixing the visual inconsistency, the broken button hierarchy, and the accessibility gaps (no focus trap, no Escape, no scroll lock) that come from not using the existing Radix-based `dialog.tsx`.

**Architecture:** Two new presentation-only primitives (`form-dialog.tsx`, `field.tsx`) built on the existing `@/components/ui/dialog` Radix wrapper and existing design tokens. Three existing surfaces are refit to consume them with no changes to data flow, props contracts (except one new component's props, mirrored from existing local state), or business logic.

**Tech Stack:** React + TypeScript, Tailwind (existing design tokens in `src/index.css`), Radix UI (`@radix-ui/react-dialog`, already a dependency via `dialog.tsx`), Vitest + React Testing Library (existing pattern, see `ProjectTaskPane.test.tsx`).

## Global Constraints

- No changes to `onChange`/`onSave`/`onAdd` contracts on any existing component — this is a presentation-layer change only.
- No new dependencies. Everything is built on `@radix-ui/react-dialog` (already used by `src/components/ui/dialog.tsx`) and existing Tailwind tokens.
- No changes to `src/index.css` design tokens (colors, radii, shadows) — compose existing tokens only. The one addition is a `::-webkit-calendar-picker-indicator` rule, which is new CSS, not a token change.
- The primary action in every `FormDialog` footer must be `actsix-btn-primary` (solid teal) — never `actsix-btn-soft` or `outline`.
- Field labels are sentence case (`text-sm font-semibold`), not `label-eyebrow`. `label-eyebrow` is reserved for `FieldGroup` section headings.
- Every modified file must pass `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm test`, and `npm run build` before being considered done.
- Follow existing repo conventions: `cn()` from `@/lib/utils` for class merging, `React.forwardRef` for DOM-forwarding components, named exports matching existing `ui/` component files.

---

### Task 1: Field primitives (`Field`, `FieldGroup`, `FieldRow`, `CheckboxField`, `fieldControlClass`)

**Files:**
- Create: `src/components/ui/field.tsx`
- Test: `src/components/ui/field.test.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`.
- Produces (used by Tasks 3, 4, 5):
  - `export const fieldControlClass: string` — a class string applied to `Input`, native `<select>`, and `<textarea>`.
  - `export function Field(props: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode; className?: string }): JSX.Element`
  - `export function FieldGroup(props: { title: string; children: React.ReactNode; className?: string }): JSX.Element`
  - `export function FieldRow(props: { children: React.ReactNode; className?: string }): JSX.Element`
  - `export function CheckboxField(props: { id: string; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; className?: string }): JSX.Element`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/ui/field.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckboxField, Field, FieldGroup, FieldRow, fieldControlClass } from "./field";

describe("Field", () => {
  it("renders a label wired to the control via htmlFor/id and an optional hint", () => {
    render(
      <Field label="Project name" htmlFor="project-name" hint="Renaming also updates linked tasks.">
        <input id="project-name" />
      </Field>,
    );

    const input = screen.getByLabelText("Project name");
    expect(input).toBeInTheDocument();
    expect(screen.getByText("Renaming also updates linked tasks.")).toBeInTheDocument();
  });

  it("omits the hint element when no hint is passed", () => {
    render(
      <Field label="Area" htmlFor="area">
        <input id="area" />
      </Field>,
    );

    expect(screen.queryByText(/./, { selector: "p" })).not.toBeInTheDocument();
  });
});

describe("FieldGroup", () => {
  it("renders a title and its children", () => {
    render(
      <FieldGroup title="Schedule">
        <div>child content</div>
      </FieldGroup>,
    );

    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});

describe("FieldRow", () => {
  it("renders its children in a row container", () => {
    render(
      <FieldRow>
        <div>left</div>
        <div>right</div>
      </FieldRow>,
    );

    expect(screen.getByText("left")).toBeInTheDocument();
    expect(screen.getByText("right")).toBeInTheDocument();
  });
});

describe("CheckboxField", () => {
  it("renders a real checkbox and calls onCheckedChange with the new value", () => {
    const onCheckedChange = vi.fn();
    render(
      <CheckboxField
        id="is-event"
        label="This project is an event"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "This project is an event" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe("fieldControlClass", () => {
  it("is a non-empty class string", () => {
    expect(typeof fieldControlClass).toBe("string");
    expect(fieldControlClass.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/field.test.tsx`
Expected: FAIL — `Cannot find module './field'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ui/field.tsx
import * as React from "react";

import { cn } from "@/lib/utils";

export const fieldControlClass =
  "h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15";

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({ label, htmlFor, hint, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type FieldGroupProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function FieldGroup({ title, children, className }: FieldGroupProps) {
  return (
    <section className={cn("space-y-4 border-t border-border/70 pt-5 first:border-t-0 first:pt-0", className)}>
      <h3 className="label-eyebrow">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

type FieldRowProps = {
  children: React.ReactNode;
  className?: string;
};

export function FieldRow({ children, className }: FieldRowProps) {
  return <div className={cn("grid items-start gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

type CheckboxFieldProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

export function CheckboxField({ id, label, checked, onCheckedChange, className }: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className={cn("flex items-center gap-3 text-sm font-semibold", className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="h-4 w-4 accent-brand-teal"
      />
      {label}
    </label>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/field.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/field.tsx src/components/ui/field.test.tsx
git commit -m "feat: add Field, FieldGroup, FieldRow, CheckboxField primitives"
```

---

### Task 2: `FormDialog` shell

**Files:**
- Create: `src/components/ui/form-dialog.tsx`
- Test: `src/components/ui/form-dialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` from `@/components/ui/dialog` (`src/components/ui/dialog.tsx`); `cn` from `@/lib/utils`.
- Produces (used by Tasks 3, 4):

```tsx
export type FormDialogSize = "sm" | "md" | "lg";

export type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title: string;
  description?: string;
  size?: FormDialogSize; // default "md"
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function FormDialog(props: FormDialogProps): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/ui/form-dialog.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormDialog } from "./form-dialog";

describe("FormDialog", () => {
  it("renders eyebrow, title, description, body, and footer when open", () => {
    render(
      <FormDialog
        open
        onOpenChange={() => {}}
        eyebrow="Edit Project"
        title="Project details"
        description="Update the project name, area, status, and notes."
        footer={<button>Save project</button>}
      >
        <div>body content</div>
      </FormDialog>,
    );

    expect(screen.getByText("Edit Project")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project details" })).toBeInTheDocument();
    expect(screen.getByText("Update the project name, area, status, and notes.")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save project" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(
      <FormDialog open={false} onOpenChange={() => {}} title="Project details">
        <div>body content</div>
      </FormDialog>,
    );

    expect(screen.queryByText("body content")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when the built-in close control is activated", () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialog open onOpenChange={onOpenChange} title="Project details">
        <div>body content</div>
      </FormDialog>,
    );

    screen.getByRole("button", { name: /close/i }).click();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("omits the eyebrow and description when not provided", () => {
    render(
      <FormDialog open onOpenChange={() => {}} title="Add Section">
        <div>body content</div>
      </FormDialog>,
    );

    expect(screen.getByRole("heading", { name: "Add Section" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/form-dialog.test.tsx`
Expected: FAIL — `Cannot find module './form-dialog'`

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ui/form-dialog.tsx
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type FormDialogSize = "sm" | "md" | "lg";

const sizeClass: Record<FormDialogSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

export type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title: string;
  description?: string;
  size?: FormDialogSize;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Shared dialog shell for ACTSIX forms. The footer's primary action must
 * always use `actsix-btn-primary` (solid teal) — that consistency is the
 * whole point of centralizing this shell.
 */
export function FormDialog({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  size = "md",
  footer,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92svh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-h-[88vh]",
          "bottom-0 top-auto translate-y-0 rounded-b-none data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "sm:bottom-auto sm:top-[50%] sm:translate-y-[-50%] sm:rounded-[var(--radius-overlay)] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
          sizeClass[size],
        )}
      >
        <DialogHeader className="border-b border-border/70 p-4 text-left sm:p-5">
          {eyebrow && <p className="label-eyebrow">{eyebrow}</p>}
          <DialogTitle className="mt-1">{title}</DialogTitle>
          {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/form-dialog.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/form-dialog.tsx src/components/ui/form-dialog.test.tsx
git commit -m "feat: add shared FormDialog shell on top of the Radix dialog primitive"
```

---

### Task 3: Refit `ProjectEditorModal`

**Files:**
- Modify: `src/features/projects/components/ProjectEditorModal.tsx` (full rewrite of the JSX body; props unchanged)
- Test: `src/features/projects/components/ProjectEditorModal.test.tsx`

**Interfaces:**
- Consumes: `FormDialog` from `@/components/ui/form-dialog` (Task 2); `Field`, `FieldGroup`, `FieldRow`, `CheckboxField`, `fieldControlClass` from `@/components/ui/field` (Task 1); existing `Button`, `Input`, `PeopleMultiSearchSelect`.
- Produces: no change to the exported `ProjectEditorModalProps` type or default export signature. `ProjectDetailPage.tsx` requires no changes for this task.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/projects/components/ProjectEditorModal.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectEditorModal from "./ProjectEditorModal";

const baseProject = {
  id: "p1",
  name: "SWBC Transition",
  area: "General",
  status: "In Progress",
  due_date: null,
  notes: "",
  is_event: false,
  add_to_calendar: false,
  created_at: "2026-01-01T00:00:00Z",
};

describe("ProjectEditorModal", () => {
  it("renders nothing when project is null", () => {
    const { container } = render(
      <ProjectEditorModal project={null} onChange={() => {}} onClose={() => {}} onSave={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the project name and calls onChange when edited", () => {
    const onChange = vi.fn();
    render(
      <ProjectEditorModal project={baseProject} onChange={onChange} onClose={() => {}} onSave={() => {}} />,
    );

    const nameInput = screen.getByLabelText("Project name");
    expect(nameInput).toHaveValue("SWBC Transition");

    fireEvent.change(nameInput, { target: { value: "New Name" } });

    expect(onChange).toHaveBeenCalledWith({ ...baseProject, name: "New Name" });
  });

  it("uses a solid primary Save button", () => {
    render(
      <ProjectEditorModal project={baseProject} onChange={() => {}} onClose={() => {}} onSave={() => {}} />,
    );

    const saveButton = screen.getByRole("button", { name: /save project/i });
    expect(saveButton.className).toContain("actsix-btn-primary");
  });

  it("calls onSave when Save is clicked and onClose when Cancel is clicked", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <ProjectEditorModal project={baseProject} onChange={() => {}} onClose={onClose} onSave={onSave} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /save project/i }));
    expect(onSave).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders This project is an event as a real checkbox", () => {
    render(
      <ProjectEditorModal project={baseProject} onChange={() => {}} onClose={() => {}} onSave={() => {}} />,
    );

    expect(screen.getByRole("checkbox", { name: /this project is an event/i })).toBeInTheDocument();
  });

  it("shows the delete action only when onDelete is provided", () => {
    const { rerender } = render(
      <ProjectEditorModal project={baseProject} onChange={() => {}} onClose={() => {}} onSave={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /delete project/i })).not.toBeInTheDocument();

    rerender(
      <ProjectEditorModal
        project={baseProject}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /delete project/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/projects/components/ProjectEditorModal.test.tsx`
Expected: FAIL — current implementation doesn't wire `htmlFor`/`id` the way the new `Field` label-click will need for `getByLabelText`, and the checkbox/button-class assertions won't match yet. (If any coincidentally pass against the old code, that's fine — Step 4 confirms the real target.)

- [ ] **Step 3: Rewrite the implementation**

```tsx
// src/features/projects/components/ProjectEditorModal.tsx
import { Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, FieldGroup, FieldRow, CheckboxField, fieldControlClass } from "@/components/ui/field";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { cn } from "@/lib/utils";

type PersonOption = {
  id: string;
  display_name: string;
  email?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
};

type ProjectEditorModalProps = {
  project: any;
  saving?: boolean;
  people?: PersonOption[];
  selectedCollaboratorIds?: string[];
  onCollaboratorChange?: (personIds: string[]) => void;
  showCollaborators?: boolean;
  onChange: (project: any) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

const ProjectEditorModal = ({
  project,
  saving = false,
  people = [],
  selectedCollaboratorIds = [],
  onCollaboratorChange,
  showCollaborators = false,
  onChange,
  onClose,
  onSave,
  onDelete,
}: ProjectEditorModalProps) => {
  if (!project) return null;

  const nameId = "project-editor-name";
  const areaId = "project-editor-area";
  const statusId = "project-editor-status";
  const dueDateId = "project-editor-due-date";
  const eventStartId = "project-editor-event-start";
  const eventEndId = "project-editor-event-end";
  const notesId = "project-editor-notes";

  return (
    <FormDialog
      open={Boolean(project)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      eyebrow="Edit Project"
      title="Project details"
      description="Update the project name, area, status, and notes."
      size="lg"
      footer={
        <>
          <div className="flex items-center gap-4">
            <p className="text-xs text-muted-foreground">
              Created:{" "}
              {project.created_at ? new Date(project.created_at).toLocaleDateString() : "Unknown"}
            </p>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete project
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" className="rounded-lg" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              className="actsix-btn-primary rounded-lg font-bold"
              onClick={onSave}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save project"}
            </Button>
          </div>
        </>
      }
    >
      <FieldGroup title="Project identity">
        <Field label="Project name" htmlFor={nameId} hint="Renaming this project will also update linked tasks.">
          <Input
            id={nameId}
            value={project.name ?? ""}
            onChange={(event) => onChange({ ...project, name: event.target.value })}
            className={cn(fieldControlClass)}
            placeholder="Project name"
          />
        </Field>

        <FieldRow>
          <Field label="Area" htmlFor={areaId}>
            <Input
              id={areaId}
              value={project.area ?? "General"}
              onChange={(event) => onChange({ ...project, area: event.target.value })}
              className={cn(fieldControlClass)}
              placeholder="General, Worship, Admin..."
            />
          </Field>

          <Field label="Status" htmlFor={statusId}>
            <select
              id={statusId}
              value={project.status ?? "In Progress"}
              onChange={(event) => onChange({ ...project, status: event.target.value })}
              className={cn(fieldControlClass)}
            >
              <option>In Progress</option>
              <option>Planning</option>
              <option>On Hold</option>
              <option>Completed</option>
            </select>
          </Field>
        </FieldRow>
      </FieldGroup>

      <FieldGroup title="Schedule">
        <Field label="Complete by" htmlFor={dueDateId} className="max-w-xs">
          <Input
            id={dueDateId}
            type="date"
            value={project.due_date ?? ""}
            onChange={(event) => onChange({ ...project, due_date: event.target.value || null })}
            className={cn(fieldControlClass)}
          />
        </Field>

        <div className="space-y-3">
          <CheckboxField
            id="project-editor-calendar-reminder"
            label="Add reminder to calendar"
            checked={Boolean(project.add_to_calendar || project.calendar_event_id)}
            onCheckedChange={(checked) => onChange({ ...project, add_to_calendar: checked })}
          />

          <CheckboxField
            id="project-editor-is-event"
            label="This project is an event"
            checked={Boolean(project.is_event)}
            onCheckedChange={(checked) => onChange({ ...project, is_event: checked })}
          />
        </div>

        {project.is_event && (
          <FieldRow>
            <Field label="Event starts" htmlFor={eventStartId}>
              <Input
                id={eventStartId}
                type="datetime-local"
                value={project.event_start_at ?? ""}
                onChange={(event) => onChange({ ...project, event_start_at: event.target.value || null })}
                className={cn(fieldControlClass)}
              />
            </Field>

            <Field label="Event ends" htmlFor={eventEndId}>
              <Input
                id={eventEndId}
                type="datetime-local"
                value={project.event_end_at ?? ""}
                onChange={(event) => onChange({ ...project, event_end_at: event.target.value || null })}
                className={cn(fieldControlClass)}
              />
            </Field>
          </FieldRow>
        )}
      </FieldGroup>

      <FieldGroup title="Notes & people">
        <Field label="Notes" htmlFor={notesId}>
          <textarea
            id={notesId}
            value={project.notes ?? ""}
            onChange={(event) => onChange({ ...project, notes: event.target.value })}
            className={cn(fieldControlClass, "min-h-36 py-2")}
            placeholder="Describe the project goal, key details, or next thinking..."
          />
        </Field>

        {showCollaborators && (
          <Field label="Collaborators">
            <PeopleMultiSearchSelect
              people={people}
              selectedPersonIds={selectedCollaboratorIds}
              onChange={onCollaboratorChange || (() => undefined)}
              placeholder="Search People to add as collaborators..."
              emptyText="No matching People profiles found."
              disabled={!onCollaboratorChange}
              showAllOnFocus
            />
          </Field>
        )}
      </FieldGroup>
    </FormDialog>
  );
};

export default ProjectEditorModal;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/projects/components/ProjectEditorModal.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/features/projects/components/ProjectEditorModal.tsx src/features/projects/components/ProjectEditorModal.test.tsx
git commit -m "refactor: rebuild ProjectEditorModal on FormDialog and Field primitives"
```

---

### Task 4: Extract and refit the project section editor into `ProjectSectionEditorModal`

**Files:**
- Create: `src/features/projects/components/ProjectSectionEditorModal.tsx`
- Modify: `src/features/projects/pages/ProjectDetailPage.tsx`
  - Remove the local `type ProjectSection = {...}` declaration (currently lines 65-76) and import it from the new file instead.
  - Remove the inline section-editor JSX block (currently lines 1253-1367) and replace it with a `<ProjectSectionEditorModal ... />` usage.
  - Add the import for the new component and its exported `ProjectSection` type.
- Test: `src/features/projects/components/ProjectSectionEditorModal.test.tsx`

**Interfaces:**
- Consumes: `FormDialog` (Task 2); `Field`, `FieldGroup`, `FieldRow`, `fieldControlClass` (Task 1); `Button` from `@/components/ui/button`; `PeoplePickerPerson` type from `@/components/people/peoplePickerUtils` (this matches the actual runtime type of `assignableProjectPeople`, computed at `ProjectDetailPage.tsx:367-378` from `collaborators.people` cast to `PeopleSearchPerson[]`, which is `PeoplePickerPerson`).
- Produces (used by `ProjectDetailPage.tsx`):

```tsx
export type ProjectSection = {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  description: string;
  leader_person_id: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProjectSectionEditorModalProps = {
  section: Partial<ProjectSection> | null;
  saving: boolean;
  assignablePeople: PeoplePickerPerson[];
  onChange: (section: Partial<ProjectSection>) => void;
  onClose: () => void;
  onSave: () => void;
};

export default function ProjectSectionEditorModal(props: ProjectSectionEditorModalProps): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/projects/components/ProjectSectionEditorModal.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectSectionEditorModal from "./ProjectSectionEditorModal";

const people = [{ id: "person-1", display_name: "Jamie Rivera" }];

describe("ProjectSectionEditorModal", () => {
  it("renders nothing when section is null", () => {
    const { container } = render(
      <ProjectSectionEditorModal
        section={null}
        saving={false}
        assignablePeople={people}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Add Section title and a Plus-icon primary button for a new section", () => {
    render(
      <ProjectSectionEditorModal
        section={{}}
        saving={false}
        assignablePeople={people}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Add Section" })).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: /add section/i });
    expect(saveButton.className).toContain("actsix-btn-primary");
  });

  it("shows Edit Section title and Save Section label for an existing section", () => {
    render(
      <ProjectSectionEditorModal
        section={{ id: "s1", name: "Worship" }}
        saving={false}
        assignablePeople={people}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Edit Section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save section/i })).toBeInTheDocument();
  });

  it("lists assignable people as leader options and calls onChange on selection", () => {
    const onChange = vi.fn();
    render(
      <ProjectSectionEditorModal
        section={{ id: "s1", name: "Worship" }}
        saving={false}
        assignablePeople={people}
        onChange={onChange}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    const leaderSelect = screen.getByLabelText("Leader");
    fireEvent.change(leaderSelect, { target: { value: "person-1" } });

    expect(onChange).toHaveBeenCalledWith({ id: "s1", name: "Worship", leader_person_id: "person-1" });
  });

  it("has exactly one dismiss control (no redundant Close pill)", () => {
    render(
      <ProjectSectionEditorModal
        section={{ id: "s1", name: "Worship" }}
        saving={false}
        assignablePeople={people}
        onChange={() => {}}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: /^close$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/projects/components/ProjectSectionEditorModal.test.tsx`
Expected: FAIL — `Cannot find module './ProjectSectionEditorModal'`

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/projects/components/ProjectSectionEditorModal.tsx
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, FieldGroup, FieldRow, fieldControlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { PeoplePickerPerson } from "@/components/people/peoplePickerUtils";

export type ProjectSection = {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  description: string;
  leader_person_id: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProjectSectionEditorModalProps = {
  section: Partial<ProjectSection> | null;
  saving: boolean;
  assignablePeople: PeoplePickerPerson[];
  onChange: (section: Partial<ProjectSection>) => void;
  onClose: () => void;
  onSave: () => void;
};

const ProjectSectionEditorModal = ({
  section,
  saving,
  assignablePeople,
  onChange,
  onClose,
  onSave,
}: ProjectSectionEditorModalProps) => {
  if (!section) return null;

  const isEditing = Boolean(section.id);

  return (
    <FormDialog
      open={Boolean(section)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      eyebrow="Project Sections"
      title={isEditing ? "Edit Section" : "Add Section"}
      description="Sections group related tasks and can have one leader from the project collaborators."
      size="md"
      footer={
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="actsix-btn-primary rounded-xl"
            onClick={onSave}
            disabled={saving}
          >
            {isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? "Saving..." : isEditing ? "Save Section" : "Add Section"}
          </Button>
        </div>
      }
    >
      <Field label="Section name" htmlFor="section-editor-name">
        <Input
          id="section-editor-name"
          value={section.name || ""}
          onChange={(event) => onChange({ ...section, name: event.target.value })}
          placeholder="Worship, Media, Logistics..."
          className={cn(fieldControlClass)}
        />
      </Field>

      <FieldRow>
        <Field
          label="Leader"
          htmlFor="section-editor-leader"
          hint="Add someone as a collaborator before making them a section leader."
        >
          <select
            id="section-editor-leader"
            value={section.leader_person_id || ""}
            onChange={(event) => onChange({ ...section, leader_person_id: event.target.value || null })}
            className={cn(fieldControlClass)}
          >
            <option value="">No leader</option>
            {assignablePeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.display_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" htmlFor="section-editor-status">
          <select
            id="section-editor-status"
            value={section.status || "Active"}
            onChange={(event) => onChange({ ...section, status: event.target.value })}
            className={cn(fieldControlClass)}
          >
            <option>Not started</option>
            <option>Active</option>
            <option>Blocked</option>
            <option>Complete</option>
          </select>
        </Field>
      </FieldRow>

      <Field
        label="Description"
        htmlFor="section-editor-description"
        hint="Shows next to the leader's name, so keep it short."
      >
        <Input
          id="section-editor-description"
          value={section.description || ""}
          onChange={(event) => onChange({ ...section, description: event.target.value })}
          placeholder="What this workstream covers..."
          className={cn(fieldControlClass)}
        />
      </Field>
    </FormDialog>
  );
};

export default ProjectSectionEditorModal;
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npx vitest run src/features/projects/components/ProjectSectionEditorModal.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire the new component into `ProjectDetailPage.tsx`**

5a. Remove the local type declaration at `ProjectDetailPage.tsx:65-76`:

```tsx
// DELETE this block:
type ProjectSection = {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  description: string;
  leader_person_id: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
```

5b. Add the import near the other component imports (after the `ProjectEditorModal` import at line 13):

```tsx
import ProjectSectionEditorModal, {
  type ProjectSection,
} from "@/features/projects/components/ProjectSectionEditorModal";
```

5c. Replace the entire inline block currently at `ProjectDetailPage.tsx:1253-1367` (the `{editingSection && (...)}` JSX using a hand-rolled overlay, `Card`, and duplicate Close/Cancel controls) with:

```tsx
<ProjectSectionEditorModal
  section={editingSection}
  saving={savingSection}
  assignablePeople={assignableProjectPeople}
  onChange={setEditingSection}
  onClose={() => setEditingSection(null)}
  onSave={saveSection}
/>
```

5d. Confirm no other reference to `ProjectSection` in `ProjectDetailPage.tsx` breaks — `editingSection`, `saveSection`, `removeSection`, and `railSections`/`sectionNameById` all consume the type structurally, so the import swap is sufficient; no call sites change.

- [ ] **Step 6: Typecheck and lint the whole page**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: no errors. If `ProjectDetailPage.tsx` still imports `Card` only for the removed block, confirm `Card` is still used elsewhere in the file (it is, for other page sections) before touching that import.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the new `ProjectSectionEditorModal.test.tsx` and the untouched `ProjectTaskPane.test.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/features/projects/components/ProjectSectionEditorModal.tsx src/features/projects/components/ProjectSectionEditorModal.test.tsx src/features/projects/pages/ProjectDetailPage.tsx
git commit -m "refactor: extract section editor into ProjectSectionEditorModal on FormDialog"
```

---

### Task 5: Refit `ProjectAddTaskRow`

**Files:**
- Modify: `src/features/projects/components/ProjectAddTaskRow.tsx`
- Test: modify `src/features/projects/components/ProjectAddTaskRow.test.tsx` if it exists, else create it (no existing dedicated test file was found; coverage currently comes indirectly through `ProjectTaskPane.test.tsx`, which is left untouched per the spec).

**Interfaces:**
- Consumes: `fieldControlClass` from `@/components/ui/field` (Task 1); existing `Button`, `Input`, `PeopleSearchSelect`.
- Produces: no change to `NewTaskDraft` or `ProjectAddTaskRowProps` — same exported names and shapes, so `ProjectTaskPane.tsx` requires no changes.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/projects/components/ProjectAddTaskRow.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectAddTaskRow from "./ProjectAddTaskRow";

describe("ProjectAddTaskRow", () => {
  it("keeps the compose row collapsed until Add task is clicked", () => {
    render(<ProjectAddTaskRow targetName="Worship" people={[]} onAdd={async () => {}} />);

    expect(screen.queryByPlaceholderText(/Add task to Worship/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add task/ }));
    expect(screen.getByPlaceholderText(/Add task to Worship/)).toBeInTheDocument();
  });

  it("dismisses via an icon-only close control rather than a text Cancel button", () => {
    render(<ProjectAddTaskRow targetName="Worship" people={[]} onAdd={async () => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Add task/ }));

    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: /close|dismiss/i });
    fireEvent.click(closeButton);

    expect(screen.queryByPlaceholderText(/Add task to Worship/)).not.toBeInTheDocument();
  });

  it("submits the trimmed title via onAdd", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ProjectAddTaskRow targetName="Worship" people={[]} onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /Add task/ }));
    fireEvent.change(screen.getByPlaceholderText(/Add task to Worship/), {
      target: { value: "  Book sound equipment  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Book sound equipment" }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/projects/components/ProjectAddTaskRow.test.tsx`
Expected: FAIL on the "icon-only close control" test — the current implementation renders a text `Cancel` button.

- [ ] **Step 3: Update the implementation**

```tsx
// src/features/projects/components/ProjectAddTaskRow.tsx
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldControlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { PeopleSearchSelect, type PeopleSearchPerson } from "@/components/people/PeopleSearchSelect";

export type NewTaskDraft = {
  title: string;
  due: string;
  assigned_person_id: string;
};

type ProjectAddTaskRowProps = {
  /** Section name, used in the placeholder so the target is never ambiguous. */
  targetName: string;
  people: PeopleSearchPerson[];
  onAdd: (draft: NewTaskDraft) => Promise<void>;
};

/**
 * Collapsed to a single quiet row until it's needed. The assignee and date
 * fields used to sit permanently under every section, so four open sections
 * meant four compose forms competing with the tasks themselves.
 */
const ProjectAddTaskRow = ({ targetName, people, onAdd }: ProjectAddTaskRowProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<NewTaskDraft>({
    title: "",
    due: "",
    assigned_person_id: "",
  });
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) titleRef.current?.focus();
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setDraft({ title: "", due: "", assigned_person_id: "" });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!draft.title.trim() || saving) return;

    setSaving(true);
    await onAdd({ ...draft, title: draft.title.trim() });
    setSaving(false);

    // Assignee and date stay put so a run of related tasks is a title away.
    setDraft((current) => ({ ...current, title: "" }));
    titleRef.current?.focus();
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-9 w-full justify-start px-2 text-[13px] font-bold text-muted-foreground hover:text-brand-teal"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
      className="rounded-xl border border-border/70 bg-card p-2.5"
    >
      <div className="flex items-start gap-2">
        <Input
          ref={titleRef}
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder={`Add task to ${targetName}...`}
          className={cn(fieldControlClass, "flex-1")}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 text-muted-foreground"
          onClick={close}
          aria-label="Close add task form"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <PeopleSearchSelect
          people={people}
          selectedPersonId={draft.assigned_person_id}
          onSelect={(personId) => setDraft({ ...draft, assigned_person_id: personId })}
          placeholder="Assign..."
          emptyText="No project collaborators found."
          showAllOnFocus
        />

        <Input
          type="date"
          value={draft.due}
          onChange={(event) => setDraft({ ...draft, due: event.target.value })}
          className={cn(fieldControlClass)}
        />

        <Button
          type="submit"
          className="actsix-btn-primary h-11 min-h-11 rounded-lg px-4"
          disabled={!draft.title.trim() || saving}
        >
          {saving ? "Adding..." : "Add"}
        </Button>
      </div>
    </form>
  );
};

export default ProjectAddTaskRow;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/projects/components/ProjectAddTaskRow.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Run `ProjectTaskPane.test.tsx` to confirm no regression**

Run: `npx vitest run src/features/projects/components/ProjectTaskPane.test.tsx`
Expected: PASS unchanged — its assertions target the `Add task` trigger and the `Add task to {section}...` placeholder only (see spec's "Testing" section), neither of which changed.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/features/projects/components/ProjectAddTaskRow.tsx src/features/projects/components/ProjectAddTaskRow.test.tsx
git commit -m "refactor: give ProjectAddTaskRow an icon dismiss and shared field styling"
```

---

### Task 6: Style the native date-picker indicator

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: existing CSS custom properties `--brand-teal` (already defined per `src/index.css` review during design — used via `hsl(var(--brand-teal))` elsewhere in the file).
- Produces: no new class name; this is a global browser-pseudo-element rule, not a component API. Nothing downstream references it directly.

This is a known limitation documented in the spec: the `yyyy/mm/dd` placeholder text in `<input type="date">` is native rendering and cannot be restyled. This task only recolors the picker icon so it doesn't look like unstyled default Chrome chrome.

- [ ] **Step 1: Add the rule**

Add near the other `input`-related rules in `src/index.css` (the file already has an `input[type="date"]`-adjacent section around the mobile media query reviewed during design; add this as its own top-level rule, not nested in that media query, since it should apply at all widths):

```css
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="datetime-local"]::-webkit-calendar-picker-indicator {
  opacity: 0.65;
  filter: invert(38%) sepia(24%) saturate(1114%) hue-rotate(129deg) brightness(94%) contrast(90%);
  cursor: pointer;
}

input[type="date"]::-webkit-calendar-picker-indicator:hover,
input[type="datetime-local"]::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}
```

Note: `filter` is used instead of `color` because `::-webkit-calendar-picker-indicator` is a rendered icon, not text — this is the standard cross-browser technique for tinting it. If the resulting hue doesn't visually match `--brand-teal` closely enough on manual check (Step 2), adjust the `hue-rotate` degrees rather than switching approach.

- [ ] **Step 2: Manual verification**

Run: `npm run dev`

Open the project editor's "Complete by" field and the add-task row's date field in a Chromium-based browser (the pseudo-element is WebKit/Blink-only; Firefox/Safari fall back to the browser default silently, which is acceptable — this is a progressive enhancement, not a requirement). Confirm the calendar icon reads as teal-tinted rather than plain gray, and that hovering it darkens slightly.

- [ ] **Step 3: Typecheck, lint, build**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint && npm run build`
Expected: no errors (this is a CSS-only change, so these are a regression check, not expected to catch anything specific to this task)

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "style: tint the native date-picker indicator to brand teal"
```

---

### Task 7: Full-suite verification and manual pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 2: Manual browser pass**

Run: `npm run dev`

Walk through, per the spec's Testing section:

- **Project editor:** open from a project's edit action; confirm the three `FieldGroup`s render (Project identity / Schedule / Notes & people), the "This project is an event" and "Add reminder to calendar" checkboxes look and behave like checkboxes, toggling "This project is an event" reveals the Event starts/ends fields, Save is solid teal, Cancel is outline, `Created:` + `Delete project` sit together at the footer's left, and Escape / clicking the scrim / the header `X` all close it without saving.
- **Section editor:** open "Add Section" — confirm the title reads "Add Section", the save button shows a `+` and label "Add Section", there is exactly one dismiss control in the header (`X` only, no "Close" pill) plus footer Cancel. Open "Edit Section" on an existing section — confirm title "Edit Section", save button shows a save icon and label "Save Section", and the Leader select lists collaborators.
- **Add-task row:** click "Add task" under a section, confirm the row expands with `bg-card` background (not the previous tan/background tone), the dismiss control is an `X` icon rather than a "Cancel" text button, and submitting a title adds a task and refocuses the title field for the next one.
- **Mobile width:** resize to below `640px` (Tailwind `sm` breakpoint) and repeat the project editor and section editor checks — both should render as bottom sheets (`items-end`, `rounded-b-none`) exactly as before.
- **Overlay stacking:** the add-collaborator form on `ProjectDetailPage` (the hand-rolled overlay still present around where `addCollaboratorOpen` is used, left untouched by this plan) is a separate hand-rolled overlay from the new Radix-based `FormDialog`. Open the project editor or section editor and confirm the add-collaborator form isn't reachable/openable behind it in a way that stacks two overlays with mismatched scrims; if the app's flow never allows both open simultaneously, note that and move on.
- **Console:** confirm no runtime errors or warnings in any of the above.

- [ ] **Step 3: Report**

No commit for this task — it's verification only. If manual checks reveal an issue, return to the relevant task above, fix it there, and re-run that task's automated tests before re-verifying manually.
