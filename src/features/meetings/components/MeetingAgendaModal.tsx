import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlignLeft,
  CalendarRange,
  ChevronDown,
  CopyPlus,
  CornerDownRight,
  Eye,
  GripVertical,
  List,
  ListOrdered,
  PencilLine,
  Plus,
  TextQuote,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { fieldControlClass } from "@/components/ui/field";
import { cn, getInitials } from "@/lib/utils";
import { renderMinutesHtml } from "@/features/meetings/lib/meetingMinutes";
import { toast } from "sonner";
import {
  cleanAgendaSections,
  formatDate,
  generateMinutesFromAgenda,
  isSectionEmpty,
  makeAgendaPoint,
  makeAgendaSection,
  type AgendaPoint,
  type AgendaSection,
  type AgendaSectionLayout,
} from "@/features/meetings/lib/meetingAgenda";

// Matches Button's own focus-visible treatment - the drag handles, summary
// rows and the Subheading toggle below are raw <button>s (not <Button>) so
// they need it spelled out explicitly, or keyboard focus on them is invisible.
const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";

/** Icon-button size: 44px touch-target floor by default, the compact 32px
 *  desktop size once touch isn't the input method - same convention as the
 *  minutes editor's toolbar. */
const iconButtonSizeClass = "h-11 w-11 sm:h-8 sm:w-8";

/** Every field in this editor is a writing line, not a boxed input: a hairline
 *  rule that a teal underline wipes across from the left on focus. It's the
 *  one authored motion in the builder - typing should feel like writing onto
 *  a sheet, not filling in a form of grey boxes. */
const writeLineClass =
  "relative min-w-0 flex-1 border-b border-border/60 transition-colors focus-within:border-transparent " +
  "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-[1.5px] after:origin-left " +
  "after:scale-x-0 after:rounded-full after:bg-brand-teal after:transition-transform after:duration-200 " +
  "after:ease-out focus-within:after:scale-x-100 motion-reduce:after:transition-none";

/** Shared reset for the inputs sitting on those writing lines. */
const writeInputClass =
  "border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";

/** How many points a section actually has something written in - the number
 *  shown on its resting summary row. */
const filledPointCount = (section: AgendaSection) =>
  section.points.filter((point) => point.text.trim()).length;

// What each layout actually produces in the generated Minutes - shown inside
// the picker menu so the choice isn't a guess. Mirrors
// generateMinutesFromAgenda's own three branches exactly.
const LAYOUT_OPTIONS: {
  value: AgendaSectionLayout;
  label: string;
  hint: string;
  icon: typeof ListOrdered;
}[] = [
  {
    value: "list",
    label: "Discussion Point",
    hint: "Numbered, with Notes and Decisions.",
    icon: ListOrdered,
  },
  {
    value: "dated",
    label: "Dates To Remember",
    hint: "Bullets with an optional date.",
    icon: CalendarRange,
  },
  {
    value: "boxed",
    label: "Boxed",
    hint: "Plain bullets.",
    icon: List,
  },
  {
    value: "text",
    label: "Text",
    hint: "Plain lines, nothing else.",
    icon: AlignLeft,
  },
];

const layoutOption = (layout: AgendaSectionLayout) =>
  LAYOUT_OPTIONS.find((option) => option.value === layout) ?? LAYOUT_OPTIONS[0];

/** Swaps one section in place, by id. */
const updateSection = (
  sections: AgendaSection[],
  sectionId: string,
  patch: Partial<AgendaSection> | ((section: AgendaSection) => AgendaSection)
) =>
  sections.map((section) =>
    section.id === sectionId ? (typeof patch === "function" ? patch(section) : { ...section, ...patch }) : section
  );

/** Swaps one point in place, by id - used for both a section's top-level
 *  points and (given a point's own `children`) its child list. */
const updatePoint = (
  points: AgendaPoint[],
  pointId: string,
  patch: Partial<AgendaPoint> | ((point: AgendaPoint) => AgendaPoint)
) =>
  points.map((point) =>
    point.id === pointId ? (typeof patch === "function" ? patch(point) : { ...point, ...patch }) : point
  );

/** Fresh ids throughout - a duplicated section must not share point ids with
 *  its original, or every keystroke would land in both copies. */
const duplicateSection = (section: AgendaSection): AgendaSection => ({
  ...section,
  id: crypto.randomUUID(),
  points: section.points.map((point) => ({
    ...point,
    id: crypto.randomUUID(),
    children: point.children.map((child) => ({ ...child, id: crypto.randomUUID() })),
  })),
});

/** Every text field in a section, top to bottom - how Backspace-on-empty knows
 *  which field to put the caret back into. */
const orderedFieldIds = (section: AgendaSection) => {
  const ids = [`heading-${section.id}`];
  section.points.forEach((point) => {
    ids.push(point.id);
    point.children.forEach((child) => ids.push(child.id));
  });
  return ids;
};

/** A person who can carry an agenda point - the meeting's own people list. */
export type AgendaOwnerOption = { id: string; name: string };

export type MeetingAgendaModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AgendaSection[];
  onChange: (updater: (sections: AgendaSection[]) => AgendaSection[]) => void;
  onSave: () => void;
  /** True when the meeting already has written minutes that a refill would replace. */
  minutesAtRisk?: boolean;
  /** The same builder edits a recurring series' regular agenda, where the
   *  saved agenda is a template rather than one meeting's - only the framing
   *  copy differs, so both surfaces stay one component. */
  title?: string;
  description?: string;
  saveLabel?: string;
  /** Meeting people offered as point owners. Empty (a recurring series' regular
   *  agenda, which has no attendee list of its own) hides the control. */
  people?: AgendaOwnerOption[];
};

export function MeetingAgendaModal({
  open,
  onOpenChange,
  draft,
  onChange,
  onSave,
  minutesAtRisk = false,
  title = "Edit Agenda",
  description,
  saveLabel = "Save Agenda",
  people = [],
}: MeetingAgendaModalProps) {
  // One section is being written in at a time; the rest rest as quiet summary
  // cards. Focus is the source of truth - clicking a card, tabbing into it, or
  // landing there after an add all route through the same activation - so the
  // keyboard and the pointer never disagree about which card is open.
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // The subheading stays put away for the common case (a plain section) - this is
  // purely display state, not agenda data, so it lives here rather than in the
  // draft. A section that already has a subheading opens by default so
  // existing content is never hidden behind an extra click.
  const [expandedSubheadingSections, setExpandedSubheadingSections] = useState<Set<string>>(new Set());

  // Closing (Escape, outside-click, the header X) used to silently discard
  // whatever was typed since the draft resets from the saved agenda every
  // time the modal opens - so re-opening it looked like nothing happened,
  // but the edits were gone. Snapshot the draft on open and confirm before
  // losing anything that's changed since.
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const baselineRef = useRef<AgendaSection[] | null>(null);

  // A section can hold several points' worth of typing - deleting one by
  // accident is a bigger loss than deleting a single point, so it gets a
  // confirm step. An already-empty section (nothing typed yet) skips it.
  const [removeSectionId, setRemoveSectionId] = useState<string | null>(null);

  // Set by any action that creates or removes a row; the effect below moves
  // the caret there once React has actually rendered it.
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  // Preview swaps the canvas for the minutes this agenda will produce, rather
  // than sitting beside it - the builder is a writing column, and a permanent
  // second column would halve it for something only worth checking now and then.
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!open) return;
    baselineRef.current = draft;
    // A section with nothing in it needs typing into right away, so it opens -
    // as does a one-section agenda, which has nothing to rest against. A
    // written, multi-section agenda opens fully at rest instead, so its whole
    // shape is visible before anything is touched.
    setActiveSectionId(draft.find(isSectionEmpty)?.id ?? (draft.length === 1 ? draft[0].id : null));
    setPreviewing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!pendingFocusId) return;
    const field = document.querySelector<HTMLInputElement>(`[data-agenda-field="${pendingFocusId}"]`);
    field?.focus();
    // Caret to the end rather than selecting - landing on a row that already
    // has text (the Backspace-deletes-upward path) must not put the next
    // keystroke in a position to wipe it.
    if (field && field.type === "text") field.setSelectionRange(field.value.length, field.value.length);
    setPendingFocusId(null);
  }, [pendingFocusId, draft]);

  const isDirty = open && baselineRef.current !== null && JSON.stringify(draft) !== JSON.stringify(baselineRef.current);

  const totals = useMemo(
    () => ({
      sections: draft.length,
      points: draft.reduce(
        (running, section) =>
          running +
          section.points.filter((point) => point.text.trim()).length +
          section.points.reduce(
            (nested, point) => nested + point.children.filter((child) => child.text.trim()).length,
            0
          ),
        0
      ),
    }),
    [draft]
  );

  // Generated from the *cleaned* draft, not the raw one - blank sections and
  // points are pruned on save, so a preview built from the raw draft would
  // promise rows that saving then drops.
  const previewMinutes = useMemo(
    () => (previewing ? generateMinutesFromAgenda(cleanAgendaSections(draft)) : ""),
    [previewing, draft]
  );

  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const requestClose = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onOpenChange(nextOpen);
  };

  const removeSection = (sectionId: string) =>
    onChange((sections) =>
      sections.length > 1 ? sections.filter((item) => item.id !== sectionId) : [makeAgendaSection()]
    );

  const addSectionAfter = (sectionId?: string) => {
    const created = makeAgendaSection();
    onChange((sections) => {
      const at = sectionId ? sections.findIndex((section) => section.id === sectionId) : -1;
      if (at === -1) return [...sections, created];
      return [...sections.slice(0, at + 1), created, ...sections.slice(at + 1)];
    });
    setActiveSectionId(created.id);
    setPendingFocusId(`heading-${created.id}`);
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange((sections) => {
      const from = sections.findIndex((section) => section.id === active.id);
      const to = sections.findIndex((section) => section.id === over.id);
      return from === -1 || to === -1 ? sections : arrayMove(sections, from, to);
    });
  };

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        // Radix's default is to focus the first tabbable thing, which here is a
        // section's drag handle - a focus ring on a grip is a strange way to
        // open an editor. Hold focus on the panel itself instead; Escape and
        // the focus trap still work, and the first Tab lands on the heading.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        className="flex h-[92vh] max-h-[92vh] w-[min(60rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-[var(--radius-panel)] border-border/70 bg-background p-0 shadow-lg focus:outline-none"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/70 bg-card px-6 pb-4 pt-5 text-left">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <DialogTitle>{title}</DialogTitle>
                <span className="text-xs font-bold tabular-nums text-muted-foreground">
                  {totals.sections} section{totals.sections === 1 ? "" : "s"} · {totals.points} point
                  {totals.points === 1 ? "" : "s"}
                </span>
              </div>
              <DialogDescription>
                {description ??
                  (minutesAtRisk
                    ? "Your written minutes stay as they are — we'll ask before replacing them."
                    : "Saving fills the minutes with an outline to write into.")}
              </DialogDescription>
            </div>

            {/* Two views of one thing, so a segmented control rather than a
                button that changes its own label - the pair shows there's
                somewhere to go back to. */}
            {/* The 44px mobile touch floor is in px while h-* is in rem, and the
                root font-size steps down on small screens - so the track is
                sized in px here, or its own buttons grow out of it. */}
            <div className="actsix-segmented min-h-[52px] shrink-0 sm:min-h-0 sm:h-9" role="group" aria-label="Agenda view">
              {[
                { value: false, label: "Build", icon: PencilLine },
                { value: true, label: "Preview", icon: Eye },
              ].map((view) => (
                <button
                  key={view.label}
                  type="button"
                  data-state={previewing === view.value ? "active" : "inactive"}
                  aria-pressed={previewing === view.value}
                  onClick={() => setPreviewing(view.value)}
                  className={cn(
                    "actsix-segmented-item flex items-center gap-1.5 px-3 text-xs font-bold",
                    focusRingClass
                  )}
                >
                  <view.icon className="h-3.5 w-3.5" />
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-8">
          {previewing ? (
            <div className="mx-auto w-full max-w-[42rem]">
              {previewMinutes ? (
                <>
                  {/* Rendered through the same renderMinutesHtml the Minutes
                      editor uses, on the same .minutes-document styles - a
                      preview that formatted itself would be showing something
                      the minutes never become. */}
                  <div
                    className="minutes-document rounded-[var(--radius-panel)] border border-border/70 bg-card p-6 text-sm leading-6 shadow-sm sm:p-8"
                    dangerouslySetInnerHTML={{ __html: renderMinutesHtml(previewMinutes) }}
                  />
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Saving writes this into Minutes, ready to type notes and decisions under each point.
                  </p>
                </>
              ) : (
                <div className="actsix-empty-state">
                  Nothing to preview yet — write a heading or an agenda point and it&apos;ll show up here.
                </div>
              )}
            </div>
          ) : (
          <>
          <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={draft.map((section) => section.id)} strategy={verticalListSortingStrategy}>
              <div className="mx-auto w-full max-w-[36rem] space-y-3">
                {draft.map((section, sectionIndex) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    sectionIndex={sectionIndex}
                    sectionCount={draft.length}
                    active={activeSectionId === section.id}
                    dragSensors={dragSensors}
                    people={people}
                    subheadingOpen={expandedSubheadingSections.has(section.id) || Boolean(section.subtitle)}
                    onOpenSubheading={() => setExpandedSubheadingSections((ids) => new Set(ids).add(section.id))}
                    onActivate={() => {
                      // The summary row the click landed on is about to
                      // unmount - hand focus to the heading rather than
                      // dropping it on the body.
                      setActiveSectionId(section.id);
                      setPendingFocusId(`heading-${section.id}`);
                    }}
                    onChange={onChange}
                    onFocusField={setPendingFocusId}
                    onDuplicate={() => {
                      const copy = duplicateSection(section);
                      onChange((sections) => {
                        const at = sections.findIndex((item) => item.id === section.id);
                        return [...sections.slice(0, at + 1), copy, ...sections.slice(at + 1)];
                      });
                      setActiveSectionId(copy.id);
                      setPendingFocusId(`heading-${copy.id}`);
                    }}
                    onAddSectionBelow={() => addSectionAfter(section.id)}
                    onRemove={() =>
                      isSectionEmpty(section) ? removeSection(section.id) : setRemoveSectionId(section.id)
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mx-auto mt-3 w-full max-w-[36rem]">
            <button
              type="button"
              onClick={() => addSectionAfter()}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-[var(--radius-panel)] border border-dashed border-border/80 px-4 py-4 text-sm font-bold text-muted-foreground transition hover:border-brand-teal/40 hover:bg-brand-teal/5 hover:text-brand-teal",
                focusRingClass
              )}
            >
              <Plus className="h-4 w-4" />
              Add section
            </button>
          </div>
          </>
          )}
        </div>

        <DialogFooter className="shrink-0 items-center gap-2 border-t border-border/70 bg-card px-6 py-4 sm:justify-between sm:gap-0">
          {previewing ? (
            <p className="hidden text-xs text-muted-foreground sm:block">
              Preview of the minutes outline this agenda generates.
            </p>
          ) : (
            <p className="hidden text-xs text-muted-foreground sm:block">
              <kbd className="rounded border border-border/70 px-1 font-mono text-[10px]">Enter</kbd> next point ·{" "}
              <kbd className="rounded border border-border/70 px-1 font-mono text-[10px]">Tab</kbd> make it a sub-point
            </p>
          )}
          <Button type="button" className="actsix-btn-primary min-h-10 rounded-xl" onClick={onSave}>
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={removeSectionId !== null}
        onOpenChange={(next) => !next && setRemoveSectionId(null)}
        title="Remove this section?"
        description="This deletes the section heading and all of its points. This can't be undone."
        confirmLabel="Remove Section"
        onConfirm={() => {
          if (removeSectionId) removeSection(removeSectionId);
          setRemoveSectionId(null);
        }}
      />

      <ConfirmDialog
        open={discardConfirmOpen}
        onOpenChange={(next) => !next && setDiscardConfirmOpen(false)}
        title="Discard unsaved changes?"
        description="You have unsaved edits to this agenda. Closing now will lose them."
        confirmLabel="Discard Changes"
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}

type SectionCardProps = {
  section: AgendaSection;
  sectionIndex: number;
  sectionCount: number;
  active: boolean;
  subheadingOpen: boolean;
  dragSensors: ReturnType<typeof useSensors>;
  people: AgendaOwnerOption[];
  onOpenSubheading: () => void;
  onActivate: () => void;
  onChange: (updater: (sections: AgendaSection[]) => AgendaSection[]) => void;
  onFocusField: (id: string) => void;
  onDuplicate: () => void;
  onAddSectionBelow: () => void;
  onRemove: () => void;
};

function SectionCard({
  section,
  sectionIndex,
  sectionCount,
  active,
  subheadingOpen,
  dragSensors,
  people,
  onOpenSubheading,
  onActivate,
  onChange,
  onFocusField,
  onDuplicate,
  onAddSectionBelow,
  onRemove,
}: SectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    transition: { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });

  const patchSection = (patch: Partial<AgendaSection> | ((item: AgendaSection) => AgendaSection)) =>
    onChange((sections) => updateSection(sections, section.id, patch));

  const pointCount = filledPointCount(section);
  const option = layoutOption(section.layout);

  /** Inserts a fresh point directly after `pointId` (or at the end) and sends
   *  the caret into it - the Enter-key path and the add-row path share it. */
  const addPointAfter = (pointId?: string) => {
    const created = makeAgendaPoint();
    patchSection((item) => {
      const at = pointId ? item.points.findIndex((point) => point.id === pointId) : -1;
      return {
        ...item,
        points:
          at === -1
            ? [...item.points, created]
            : [...item.points.slice(0, at + 1), created, ...item.points.slice(at + 1)],
      };
    });
    onFocusField(created.id);
  };

  const addChildAfter = (parentId: string, childId?: string) => {
    const created = makeAgendaPoint();
    patchSection((item) => ({
      ...item,
      points: updatePoint(item.points, parentId, (parent) => {
        const at = childId ? parent.children.findIndex((child) => child.id === childId) : -1;
        return {
          ...parent,
          children:
            at === -1
              ? [...parent.children, created]
              : [...parent.children.slice(0, at + 1), created, ...parent.children.slice(at + 1)],
        };
      }),
    }));
    onFocusField(created.id);
  };

  /** Tab on a point turns it into a sub-point of the point above it. Only
   *  meaningful on List layout - the other two never render children, and
   *  nesting is capped at one level. */
  const indentPoint = (point: AgendaPoint, pointIndex: number) => {
    if (section.layout !== "list" || pointIndex === 0 || point.children.length) return false;
    patchSection((item) => {
      const parent = item.points[pointIndex - 1];
      if (!parent) return item;
      return {
        ...item,
        points: item.points
          .filter((candidate) => candidate.id !== point.id)
          .map((candidate) =>
            candidate.id === parent.id
              ? { ...candidate, children: [...candidate.children, { ...point, children: [] }] }
              : candidate
          ),
      };
    });
    onFocusField(point.id);
    return true;
  };

  /** Shift+Tab on a sub-point lifts it back out, landing directly under its
   *  former parent. */
  const outdentChild = (parent: AgendaPoint, child: AgendaPoint) => {
    patchSection((item) => {
      const at = item.points.findIndex((candidate) => candidate.id === parent.id);
      if (at === -1) return item;
      const stripped = {
        ...item.points[at],
        children: item.points[at].children.filter((candidate) => candidate.id !== child.id),
      };
      return {
        ...item,
        points: [...item.points.slice(0, at), stripped, { ...child, children: [] }, ...item.points.slice(at + 1)],
      };
    });
    onFocusField(child.id);
  };

  /** Backspace in an empty row deletes it and puts the caret at the end of the
   *  row above, so a mistyped point never needs the mouse to clear. */
  const focusPrevious = (fieldId: string) => {
    const ids = orderedFieldIds(section);
    const at = ids.indexOf(fieldId);
    if (at > 0) onFocusField(ids[at - 1]);
  };

  const removePoint = (point: AgendaPoint, pointIndex: number) => {
    // A section always keeps at least one point row, so deleting the last one
    // swaps in a fresh blank one rather than leaving the section empty - undo
    // has to put the real point back in that case, not append alongside the
    // placeholder.
    const hadContent = point.text.trim() || point.children.some((child) => child.text.trim());
    const wasOnlyPoint = section.points.length === 1;

    patchSection((item) => ({
      ...item,
      points:
        item.points.length > 1
          ? item.points.filter((candidate) => candidate.id !== point.id)
          : [makeAgendaPoint()],
    }));

    if (!hadContent) return;

    toast("Point removed", {
      action: {
        label: "Undo",
        onClick: () =>
          patchSection((item) => ({
            ...item,
            points: wasOnlyPoint
              ? [point]
              : [...item.points.slice(0, pointIndex), point, ...item.points.slice(pointIndex)],
          })),
      },
    });
  };

  const removeChild = (parent: AgendaPoint, child: AgendaPoint, childIndex: number) => {
    const hadContent = Boolean(child.text.trim());

    patchSection((item) => ({
      ...item,
      points: updatePoint(item.points, parent.id, (candidate) => ({
        ...candidate,
        children: candidate.children.filter((existing) => existing.id !== child.id),
      })),
    }));

    if (!hadContent) return;

    toast("Sub-point removed", {
      action: {
        label: "Undo",
        onClick: () =>
          patchSection((item) => ({
            ...item,
            points: updatePoint(item.points, parent.id, (candidate) => ({
              ...candidate,
              children: [
                ...candidate.children.slice(0, childIndex),
                child,
                ...candidate.children.slice(childIndex),
              ],
            })),
          })),
      },
    });
  };

  /** Sub-points reorder within their own parent only - their own context per
   *  parent, so a child can never be dropped into a sibling point's nest (the
   *  data model caps nesting at one level, and a cross-parent drop would have
   *  to invent a meaning for it). */
  const handleChildDragEnd = (parentId: string, event: DragEndEvent) => {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    patchSection((item) => ({
      ...item,
      points: updatePoint(item.points, parentId, (parent) => {
        const from = parent.children.findIndex((child) => child.id === dragged.id);
        const to = parent.children.findIndex((child) => child.id === over.id);
        return from === -1 || to === -1 ? parent : { ...parent, children: arrayMove(parent.children, from, to) };
      }),
    }));
  };

  const handlePointDragEnd = (event: DragEndEvent) => {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    patchSection((item) => {
      const from = item.points.findIndex((point) => point.id === dragged.id);
      const to = item.points.findIndex((point) => point.id === over.id);
      return from === -1 || to === -1 ? item : { ...item, points: arrayMove(item.points, from, to) };
    });
  };

  return (
    <div
      ref={setNodeRef}
      // Translate, not Transform: dnd-kit also puts a scale in the transform
      // when the dragged card and the one it's over are different heights, and
      // applying it stretches the card's text while it moves.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/section relative rounded-[var(--radius-panel)] border bg-card transition-[box-shadow,border-color,transform] duration-200 ease-out",
        active ? "border-brand-teal/30 shadow-md" : "border-border/70 shadow-sm hover:border-border",
        isDragging && "z-20 shadow-lg"
      )}
    >
      {/* The open card wears a teal spine in its own gutter rather than a
          full-height edge stripe - the same "you are here" signal the nav
          uses, at card scale, without turning the card into a callout. */}
      <span
        aria-hidden
        className={cn(
          "absolute bottom-4 left-1.5 top-4 w-[3px] origin-top rounded-full bg-brand-teal transition-transform duration-200 ease-out motion-reduce:transition-none",
          active ? "scale-y-100" : "scale-y-0"
        )}
      />

      {/* Visual heading is the styled input (or the summary row) below - this
          is a real heading purely so a screen reader can jump section-to-
          section on a long agenda rather than crawling every field. */}
      <h3 className="sr-only">
        Section {sectionIndex + 1}: {section.heading.trim() || "Untitled section"}
      </h3>

      {/* Drag handle sits at the card's top edge, Forms-style, out of the way
          of the writing column until the card is hovered or open. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder section ${sectionIndex + 1}`}
        title="Drag to reorder, or use the arrow keys"
        className={cn(
          // Visible by default because a touch device has no hover to reveal
          // it with; only the pointer-driven layout earns the quieter
          // reveal-on-approach behaviour.
          "absolute -top-1 left-1/2 flex h-6 w-10 -translate-x-1/2 cursor-grab items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing md:opacity-0 md:group-hover/section:opacity-100",
          // On a narrow screen a resting card's summary text runs right under
          // this, so the handle waits until the card is open - which a tap
          // does anyway before anyone would think to drag it.
          active ? "md:opacity-100" : "max-md:hidden",
          focusRingClass
        )}
      >
        <GripVertical className="h-4 w-4 rotate-90" />
      </button>

      {active ? (
        <div className="space-y-4 px-5 pb-5 pt-6">
          <div className="flex items-start gap-3">
            <span className="mt-1.5 shrink-0 text-sm font-extrabold tabular-nums text-brand-teal">
              {sectionIndex + 1}
            </span>

            <div className={writeLineClass}>
              <Input
                value={section.heading}
                data-agenda-field={`heading-${section.id}`}
                onChange={(event) => {
                  const value = event.target.value;
                  patchSection({ heading: value });
                }}
                placeholder="Section heading"
                aria-label={`Section ${sectionIndex + 1} heading`}
                className={cn(fieldControlClass, writeInputClass, "h-10 font-bold sm:h-9 sm:text-base")}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 shrink-0 gap-1.5 rounded-full border border-border/70 px-3 text-xs font-bold text-muted-foreground hover:border-brand-teal/30 hover:bg-brand-teal/5 hover:text-brand-teal sm:h-9"
                  aria-label={`Section ${sectionIndex + 1} layout: ${option.label}`}
                >
                  <option.icon className="h-3.5 w-3.5" />
                  {option.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {LAYOUT_OPTIONS.map((item) => (
                  <DropdownMenuItem
                    key={item.value}
                    onSelect={() => patchSection({ layout: item.value })}
                    className={cn(
                      "items-start gap-2.5 py-2",
                      section.layout === item.value && "bg-brand-teal/8 text-brand-teal"
                    )}
                  >
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="space-y-0.5">
                      <span className="block text-xs font-bold">{item.label}</span>
                      <span className="block text-xs leading-snug text-muted-foreground">{item.hint}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* A subheading is a secondary concern - put away until asked for, so
              the common case is a heading and its points and nothing else. */}
          {subheadingOpen ? (
            <div className="pl-6">
              <div className="w-[18rem] max-w-full space-y-1">
                <span className="label-eyebrow">Subheading</span>
                <div className={writeLineClass}>
                  <Input
                    value={section.subtitle}
                    onChange={(event) => {
                      const value = event.target.value;
                      patchSection({ subtitle: value });
                    }}
                    placeholder="e.g. Wins, Challenges, Changes"
                    aria-label={`Section ${sectionIndex + 1} subheading`}
                    className={cn(fieldControlClass, writeInputClass, "h-9 italic sm:h-8 sm:text-xs")}
                  />
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenSubheading}
              className={cn(
                "ml-6 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold text-muted-foreground transition hover:text-brand-teal",
                focusRingClass
              )}
            >
              <TextQuote className="h-3.5 w-3.5" />
              Subheading
            </button>
          )}

          <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handlePointDragEnd}>
            <SortableContext
              items={section.points.map((point) => point.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {section.points.map((point, pointIndex) => (
                  <PointRow
                    key={point.id}
                    point={point}
                    number={`${sectionIndex + 1}.${pointIndex + 1}`}
                    label={`Section ${sectionIndex + 1}, point ${pointIndex + 1}`}
                    layout={section.layout}
                    people={people}
                    onChangeOwner={(owner) =>
                      patchSection((item) => ({
                        ...item,
                        points: updatePoint(item.points, point.id, {
                          ownerId: owner?.id ?? "",
                          ownerName: owner?.name ?? "",
                        }),
                      }))
                    }
                    onChangeText={(value) =>
                      patchSection((item) => ({
                        ...item,
                        points: updatePoint(item.points, point.id, { text: value }),
                      }))
                    }
                    onChangeDate={(value) =>
                      patchSection((item) => ({
                        ...item,
                        points: updatePoint(item.points, point.id, { date: value }),
                      }))
                    }
                    onEnter={() => addPointAfter(point.id)}
                    onIndent={() => indentPoint(point, pointIndex)}
                    onBackspaceEmpty={() => {
                      focusPrevious(point.id);
                      removePoint(point, pointIndex);
                    }}
                    // Offered on every List point, whether or not it already has
                    // children: hiding it once a point was nested left that one
                    // row a control narrower than its neighbours, and the whole
                    // column's right edge went ragged.
                    onAddSub={section.layout === "list" ? () => addChildAfter(point.id) : undefined}
                    onRemove={() => removePoint(point, pointIndex)}
                  >
                    {section.layout === "list" && point.children.length > 0 && (
                      // Sub-points hang off a hairline that starts under their
                      // parent's number - the indent is drawn, not just implied
                      // by whitespace, so a long list never loses its thread.
                      <DndContext
                        sensors={dragSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleChildDragEnd(point.id, event)}
                      >
                        <SortableContext
                          items={point.children.map((child) => child.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="ml-[1.6rem] border-l border-border/60 pl-3">
                            {point.children.map((child, childIndex) => (
                          <PointRow
                            key={child.id}
                            point={child}
                            nested
                            number={`${sectionIndex + 1}.${pointIndex + 1}.${childIndex + 1}`}
                            label={`Section ${sectionIndex + 1}, point ${pointIndex + 1}, sub-point ${childIndex + 1}`}
                            layout={section.layout}
                            people={people}
                            onChangeOwner={(owner) =>
                              patchSection((item) => ({
                                ...item,
                                points: updatePoint(item.points, point.id, (parent) => ({
                                  ...parent,
                                  children: updatePoint(parent.children, child.id, {
                                    ownerId: owner?.id ?? "",
                                    ownerName: owner?.name ?? "",
                                  }),
                                })),
                              }))
                            }
                            onChangeText={(value) =>
                              patchSection((item) => ({
                                ...item,
                                points: updatePoint(item.points, point.id, (parent) => ({
                                  ...parent,
                                  children: updatePoint(parent.children, child.id, { text: value }),
                                })),
                              }))
                            }
                            onEnter={() => addChildAfter(point.id, child.id)}
                            onOutdent={() => outdentChild(point, child)}
                            onBackspaceEmpty={() => {
                              focusPrevious(child.id);
                              removeChild(point, child, childIndex);
                            }}
                            onRemove={() => removeChild(point, child, childIndex)}
                          />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </PointRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* A phantom row rather than a button: it sits exactly where the next
              point will appear, so adding one reads as continuing the list. */}
          <button
            type="button"
            onClick={() => addPointAfter()}
            className={cn(
              "-mt-0.5 flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2 py-2 text-left text-sm text-muted-foreground transition hover:bg-brand-teal/5 hover:text-brand-teal",
              focusRingClass
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add agenda point
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onActivate}
          aria-label={`Edit section ${sectionIndex + 1}`}
          className={cn("w-full rounded-[var(--radius-panel)] px-5 py-4 text-left", focusRingClass)}
        >
          <div className="flex items-baseline gap-3">
            <span className="shrink-0 text-sm font-extrabold tabular-nums text-muted-foreground">
              {sectionIndex + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">
                {section.heading.trim() || <span className="italic text-muted-foreground">Untitled section</span>}
              </span>
              {section.subtitle.trim() && (
                <span className="mt-0.5 block truncate text-xs italic text-muted-foreground">
                  {section.subtitle.trim()}
                </span>
              )}
            </span>
            <span
              className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-muted-foreground"
              title={`${option.label} · ${option.hint}`}
            >
              <option.icon className="h-3.5 w-3.5" aria-hidden />
              <span className="rounded-full border border-border/70 px-2 py-px tabular-nums">
                {pointCount}
              </span>
              <span className="sr-only">
                {option.label}, {pointCount === 0 ? "no points" : `${pointCount} point${pointCount === 1 ? "" : "s"}`}
              </span>
            </span>
          </div>

          {/* A resting card still shows what's in it - the first few points, in
              the same numbering the minutes will carry. */}
          {pointCount > 0 && (
            <ul className="mt-2 space-y-0.5 pl-6 text-xs text-muted-foreground">
              {section.points
                .filter((point) => point.text.trim())
                .slice(0, 3)
                .map((point, previewIndex) => (
                  <li key={point.id} className="flex gap-2">
                    {section.layout !== "text" && (
                      <span className="shrink-0 tabular-nums">
                        {sectionIndex + 1}.{previewIndex + 1}
                      </span>
                    )}
                    <span className="truncate">{point.text.trim()}</span>
                    {section.layout === "dated" && point.date && (
                      <span className="ml-auto shrink-0 tabular-nums">{formatDate(point.date)}</span>
                    )}
                  </li>
                ))}
              {pointCount > 3 && (
                <li className="pt-0.5 font-bold text-muted-foreground/80">+{pointCount - 3} more</li>
              )}
            </ul>
          )}
        </button>
      )}

      {/* The card's own tools travel with it: a rail alongside the open card on
          a wide screen, a row inside it on a narrow one. Everything that acts
          on the whole section lives here and nowhere else. */}
      {active && (
        <div className="mx-5 mb-4 -mt-1 flex items-center gap-1 rounded-[var(--radius-control)] border border-border/70 bg-card p-1 shadow-sm md:absolute md:left-full md:top-5 md:mx-0 md:mb-0 md:ml-2 md:mt-0 md:flex-col">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Add section after section ${sectionIndex + 1}`}
            title="Add section below"
            className={cn(iconButtonSizeClass, "text-muted-foreground hover:text-brand-teal")}
            onClick={onAddSectionBelow}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Duplicate section ${sectionIndex + 1}`}
            title="Duplicate section"
            className={cn(iconButtonSizeClass, "text-muted-foreground hover:text-brand-teal")}
            onClick={onDuplicate}
          >
            <CopyPlus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove section ${sectionIndex + 1}`}
            title={sectionCount === 1 ? "Clear section" : "Remove section"}
            className={cn(iconButtonSizeClass, "text-muted-foreground hover:text-destructive")}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

type PointRowProps = {
  point: AgendaPoint;
  number: string;
  label: string;
  layout: AgendaSectionLayout;
  nested?: boolean;
  children?: ReactNode;
  people: AgendaOwnerOption[];
  onChangeOwner: (owner: AgendaOwnerOption | null) => void;
  onChangeText: (value: string) => void;
  onChangeDate?: (value: string) => void;
  onEnter: () => void;
  onIndent?: () => boolean;
  onOutdent?: () => void;
  onBackspaceEmpty: () => void;
  onAddSub?: () => void;
  onRemove: () => void;
};

function PointRow({
  point,
  number,
  label,
  layout,
  nested = false,
  children,
  people,
  onChangeOwner,
  onChangeText,
  onChangeDate,
  onEnter,
  onIndent,
  onOutdent,
  onBackspaceEmpty,
  onAddSub,
  onRemove,
}: PointRowProps) {
  // Sub-points reorder too, but inside their own parent's context - see
  // handleChildDragEnd. Shift+Tab is still how one leaves the nest entirely.
  const sortable = useSortable({ id: point.id });

  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={cn("group/point rounded-[var(--radius-control)]", sortable.isDragging && "relative z-10 bg-card shadow-md")}
    >
      <div className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-1 transition-colors hover:bg-brand-teal/[0.04]">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Reorder ${nested ? "sub-point" : "point"} ${number}`}
          title="Drag to reorder, or use the arrow keys"
          className={cn(
            "flex h-8 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground transition hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing md:opacity-0 md:group-hover/point:opacity-100",
            focusRingClass
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {nested && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-border" aria-hidden />}

        {/* Text sections carry no numbering into the minutes, so showing one
            here would promise a shape the saved minutes never take. */}
        {layout !== "text" && (
          <span className={cn("shrink-0 tabular-nums text-xs font-bold text-muted-foreground", nested ? "w-10" : "w-7")}>
            {number}
          </span>
        )}

        <div className={writeLineClass}>
          <Input
            value={point.text}
            data-agenda-field={point.id}
            onChange={(event) => onChangeText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onEnter();
                return;
              }
              if (event.key === "Tab" && !event.shiftKey && onIndent) {
                // Only swallow Tab when there's actually somewhere to indent
                // to - otherwise it has to keep moving focus like Tab always does.
                if (onIndent()) event.preventDefault();
                return;
              }
              if (event.key === "Tab" && event.shiftKey && onOutdent) {
                event.preventDefault();
                onOutdent();
                return;
              }
              if (event.key === "Backspace" && !point.text) {
                event.preventDefault();
                onBackspaceEmpty();
              }
            }}
            placeholder={nested ? "Sub-point" : layout === "text" ? "Text" : "Agenda point"}
            aria-label={label}
            className={cn(fieldControlClass, writeInputClass, "h-10 sm:h-8 sm:text-sm")}
          />
        </div>

        {layout === "dated" && onChangeDate && (
          <div className={cn(writeLineClass, "w-36 flex-none")}>
            <Input
              type="date"
              value={point.date}
              onChange={(event) => onChangeDate(event.target.value)}
              aria-label={`${label} date`}
              className={cn(fieldControlClass, writeInputClass, "h-10 sm:h-8 sm:text-xs")}
            />
          </div>
        )}

        {/* An owner is a badge of initials once set, and an outline of a
            person-shape until then - so a glance down the column reads as "who
            has what" rather than a row of identical buttons. */}
        {people.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={point.ownerName ? `${label} owner: ${point.ownerName}` : `Assign an owner to ${number}`}
                title={point.ownerName || "Assign an owner"}
                className={cn(
                  // 44px on touch, compact once a pointer is driving - the same
                  // floor every other control in this editor holds to.
                  "h-11 w-11 shrink-0 rounded-full p-0 text-muted-foreground transition hover:text-brand-teal focus-visible:opacity-100 sm:h-7 sm:w-7",
                  point.ownerName
                    ? "bg-brand-teal/10 text-brand-teal-dark hover:bg-brand-teal/15"
                    : "md:opacity-0 md:group-hover/point:opacity-100"
                )}
              >
                {point.ownerName ? (
                  <span className="text-[10px] font-extrabold tracking-wide">{getInitials(point.ownerName)}</span>
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {people.map((person) => (
                <DropdownMenuItem
                  key={person.id}
                  onSelect={() => onChangeOwner(person)}
                  className={cn("gap-2", point.ownerId === person.id && "bg-brand-teal/8 text-brand-teal")}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-extrabold">
                    {getInitials(person.name)}
                  </span>
                  <span className="truncate text-xs font-semibold">{person.name}</span>
                </DropdownMenuItem>
              ))}
              {point.ownerId || point.ownerName ? (
                <DropdownMenuItem onSelect={() => onChangeOwner(null)} className="text-xs font-semibold">
                  Clear owner
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onAddSub && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Add sub-point under ${number}`}
            title={`Add sub-point under ${number}`}
            className={cn(
              iconButtonSizeClass,
              "shrink-0 text-muted-foreground transition hover:text-brand-teal focus-visible:opacity-100 md:opacity-0 md:group-hover/point:opacity-100"
            )}
            onClick={onAddSub}
          >
            <CornerDownRight className="h-3.5 w-3.5" />
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${nested ? "sub-point" : "point"} ${number}`}
          title={`Remove ${nested ? "sub-point" : "point"} ${number}`}
          className={cn(
            iconButtonSizeClass,
            "shrink-0 text-muted-foreground transition hover:text-destructive focus-visible:opacity-100 md:opacity-0 md:group-hover/point:opacity-100"
          )}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {children}
    </div>
  );
}
