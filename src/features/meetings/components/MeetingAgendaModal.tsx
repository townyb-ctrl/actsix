import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { fieldControlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  isSectionEmpty,
  makeAgendaPoint,
  makeAgendaSection,
  type AgendaPoint,
  type AgendaSection,
  type AgendaSectionLayout,
} from "@/features/meetings/lib/meetingAgenda";

// Matches Button's own focus-visible treatment - the layout-picker pills and
// the Tag/Subtitle toggle below are raw <button>s (not <Button>) so they need
// it spelled out explicitly, or keyboard focus on them is invisible.
const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";

/** Icon-button size: 44px touch-target floor by default, the compact 32px
 *  desktop size once touch isn't the input method - same convention as the
 *  minutes editor's toolbar. */
const iconButtonSizeClass = "h-11 w-11 sm:h-8 sm:w-8";

/** How many points a section actually has something written in - the number
 *  shown on its collapsed summary row. */
const filledPointCount = (section: AgendaSection) => section.points.filter((point) => point.text.trim()).length;

export type MeetingAgendaModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AgendaSection[];
  onChange: (updater: (sections: AgendaSection[]) => AgendaSection[]) => void;
  onSave: () => void;
  /** True when the meeting already has written minutes that a refill would replace. */
  minutesAtRisk?: boolean;
};

// What each layout actually produces in the generated Minutes - shown as a
// one-line caption under the picker so the choice isn't a guess. Mirrors
// generateMinutesFromAgenda's own three branches exactly.
const LAYOUT_OPTIONS: { value: AgendaSectionLayout; label: string; hint: string }[] = [
  { value: "list", label: "List", hint: "Numbered points, each with space for Notes and Decisions." },
  { value: "dated", label: "Dated", hint: "A bullet list with an optional date next to each point." },
  { value: "boxed", label: "Boxed", hint: "A plain bullet list - no dates, no discussion space." },
];

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

export function MeetingAgendaModal({
  open,
  onOpenChange,
  draft,
  onChange,
  onSave,
  minutesAtRisk = false,
}: MeetingAgendaModalProps) {
  // Tag/subtitle stay collapsed for the common case (a plain section) - this
  // is purely display state, not agenda data, so it lives here rather than
  // in the draft. A section that already has a tag or subtitle opens by
  // default so existing content is never hidden behind an extra click.
  const [expandedTagSections, setExpandedTagSections] = useState<Set<string>>(new Set());

  // Closing (Escape, outside-click, the header X) used to silently discard
  // whatever was typed since the draft resets from the saved agenda every
  // time the modal opens - so re-opening it looked like nothing happened,
  // but the edits were gone. Snapshot the draft on open and confirm before
  // losing anything that's changed since.
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const baselineRef = useRef<AgendaSection[] | null>(null);

  // A real agenda runs to 7+ sections, and all of them rendering open at
  // once is why Save Agenda used to scroll out of view - collapse everything
  // to a one-line summary by default, except a section that's actually empty
  // (it needs typing into right away) or the only section in the agenda
  // (nothing to collapse against). An explicit click always overrides the
  // default, and defaults reset fresh each time the modal opens.
  const [collapseOverride, setCollapseOverride] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      baselineRef.current = draft;
      setCollapseOverride({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isSectionExpanded = (section: AgendaSection) =>
    section.id in collapseOverride ? collapseOverride[section.id] : isSectionEmpty(section) || draft.length === 1;

  const toggleSection = (section: AgendaSection) =>
    setCollapseOverride((overrides) => ({ ...overrides, [section.id]: !isSectionExpanded(section) }));

  const isDirty = open && baselineRef.current !== null && JSON.stringify(draft) !== JSON.stringify(baselineRef.current);

  const requestClose = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onOpenChange(nextOpen);
  };

  // A section can hold several points' worth of typing - deleting one by
  // accident is a bigger loss than deleting a single point, so it gets a
  // confirm step. An already-empty section (nothing typed yet) skips it.
  const [removeSectionId, setRemoveSectionId] = useState<string | null>(null);

  const removeSection = (sectionId: string) =>
    onChange((sections) =>
      sections.length > 1 ? sections.filter((item) => item.id !== sectionId) : [makeAgendaSection()]
    );

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="actsix-panel flex max-h-[86vh] max-w-3xl flex-col overflow-hidden rounded-xl p-0">
        <DialogHeader className="shrink-0 border-b border-border/70 px-5 pb-4 pt-5">
          <DialogTitle>Edit Agenda</DialogTitle>
          <DialogDescription>
            {minutesAtRisk
              ? "Build the agenda here. Your existing minutes stay exactly as they are — we'll ask first if you want to replace them."
              : "Build the agenda here. Saving will also fill the Minutes section with an outline to write into."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {draft.map((section, sectionIndex) => {
            const expanded = isSectionExpanded(section);
            const pointCount = filledPointCount(section);

            return (
            <Card key={section.id} className="actsix-panel-soft p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-sm font-extrabold text-brand-teal">
                  {sectionIndex + 1}
                </div>

                <div className="flex-1 space-y-3">
                  {/* Visual heading is the styled Input/toggle below - this is
                      a real heading purely so a screen reader can jump
                      section-to-section (headings, not a linear tab crawl)
                      on a long agenda. Text mirrors the collapsed summary. */}
                  <h3 className="sr-only">
                    Section {sectionIndex + 1}: {section.heading.trim() || "Untitled section"}
                  </h3>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] py-1 text-left",
                        focusRingClass
                      )}
                      onClick={() => toggleSection(section)}
                      aria-expanded={expanded}
                      aria-label={expanded ? `Collapse section ${sectionIndex + 1}` : `Expand section ${sectionIndex + 1}`}
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          expanded ? "rotate-0" : "-rotate-90"
                        )}
                      />
                      {expanded ? (
                        <span className="sr-only">Section {sectionIndex + 1} heading below</span>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {section.heading.trim() || <span className="italic text-muted-foreground">Untitled section</span>}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {pointCount === 0 ? "No points yet" : `${pointCount} point${pointCount === 1 ? "" : "s"}`}
                          </span>
                        </span>
                      )}
                    </button>

                    {expanded && (
                      <Input
                        value={section.heading}
                        onChange={(event) => {
                          const value = event.target.value;
                          onChange((sections) => updateSection(sections, section.id, { heading: value }));
                        }}
                        placeholder="Section heading..."
                        aria-label={`Section ${sectionIndex + 1} heading`}
                        className={cn(fieldControlClass, "min-w-0 flex-1 font-semibold")}
                      />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove section ${sectionIndex + 1}`}
                      title={`Remove section ${sectionIndex + 1}`}
                      className={cn(iconButtonSizeClass, "shrink-0 text-muted-foreground hover:text-destructive")}
                      onClick={() =>
                        isSectionEmpty(section) ? removeSection(section.id) : setRemoveSectionId(section.id)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {expanded && (() => {
                    const tagOpen =
                      expandedTagSections.has(section.id) || Boolean(section.tag || section.subtitle);

                    return (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1 rounded-full border border-border/70 p-0.5">
                            {LAYOUT_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                title={option.hint}
                                aria-pressed={section.layout === option.value}
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-bold transition",
                                  focusRingClass,
                                  section.layout === option.value
                                    ? "bg-brand-teal/10 text-brand-teal"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={() =>
                                  onChange((sections) => updateSection(sections, section.id, { layout: option.value }))
                                }
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>

                          {tagOpen ? (
                            <>
                              <Input
                                value={section.tag}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  onChange((sections) => updateSection(sections, section.id, { tag: value }));
                                }}
                                placeholder="Tag, e.g. (Allan)"
                                aria-label={`Section ${sectionIndex + 1} tag`}
                                className={`h-8 max-w-[10rem] text-xs ${fieldControlClass}`}
                              />

                              <Input
                                value={section.subtitle}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  onChange((sections) => updateSection(sections, section.id, { subtitle: value }));
                                }}
                                placeholder="Subtitle"
                                aria-label={`Section ${sectionIndex + 1} subtitle`}
                                className={`h-8 max-w-[14rem] text-xs italic ${fieldControlClass}`}
                              />
                            </>
                          ) : (
                            <button
                              type="button"
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-muted-foreground transition hover:text-brand-teal",
                                focusRingClass
                              )}
                              onClick={() =>
                                setExpandedTagSections((ids) => new Set(ids).add(section.id))
                              }
                            >
                              <Tag className="h-3.5 w-3.5" />
                              Tag / Subtitle
                            </button>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {LAYOUT_OPTIONS.find((option) => option.value === section.layout)?.hint}
                        </p>
                      </div>
                    );
                  })()}

                  {expanded && (
                  <div className="space-y-2">
                    {section.points.map((point, pointIndex) => (
                      <div key={point.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-10 shrink-0 text-xs font-bold text-muted-foreground">
                            {sectionIndex + 1}.{pointIndex + 1}
                          </div>

                          <Input
                            value={point.text}
                            onChange={(event) => {
                              const value = event.target.value;
                              onChange((sections) =>
                                updateSection(sections, section.id, (item) => ({
                                  ...item,
                                  points: updatePoint(item.points, point.id, { text: value }),
                                }))
                              );
                            }}
                            placeholder="Agenda point..."
                            aria-label={`Section ${sectionIndex + 1}, point ${pointIndex + 1}`}
                            className={cn(fieldControlClass, "min-w-0 flex-1")}
                          />

                          {section.layout === "dated" && (
                            <Input
                              type="date"
                              value={point.date}
                              onChange={(event) => {
                                const value = event.target.value;
                                onChange((sections) =>
                                  updateSection(sections, section.id, (item) => ({
                                    ...item,
                                    points: updatePoint(item.points, point.id, { date: value }),
                                  }))
                                );
                              }}
                              aria-label={`Section ${sectionIndex + 1}, point ${pointIndex + 1} date`}
                              className={cn(fieldControlClass, "w-40 shrink-0")}
                            />
                          )}

                          {section.layout === "list" && point.children.length === 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Add sub-point under ${sectionIndex + 1}.${pointIndex + 1}`}
                              title={`Add sub-point under ${sectionIndex + 1}.${pointIndex + 1}`}
                              className={cn(iconButtonSizeClass, "text-muted-foreground hover:text-brand-teal")}
                              onClick={() =>
                                onChange((sections) =>
                                  updateSection(sections, section.id, (item) => ({
                                    ...item,
                                    points: updatePoint(item.points, point.id, (parent) => ({
                                      ...parent,
                                      children: [...parent.children, makeAgendaPoint()],
                                    })),
                                  }))
                                )
                              }
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove point ${sectionIndex + 1}.${pointIndex + 1}`}
                            title={`Remove point ${sectionIndex + 1}.${pointIndex + 1}`}
                            className={cn(iconButtonSizeClass, "text-muted-foreground hover:text-destructive")}
                            onClick={() => {
                              // A section always keeps at least one point row,
                              // so deleting the last one swaps in a fresh blank
                              // one rather than leaving the section empty -
                              // undo has to put the real point back in that
                              // case, not append alongside the placeholder.
                              const hadContent = point.text.trim() || point.children.some((child) => child.text.trim());
                              const wasOnlyPoint = section.points.length === 1;
                              const removedPoint = point;
                              const removedIndex = pointIndex;

                              onChange((sections) =>
                                updateSection(sections, section.id, (item) => ({
                                  ...item,
                                  points:
                                    item.points.length > 1
                                      ? item.points.filter((agendaPoint) => agendaPoint.id !== point.id)
                                      : [makeAgendaPoint()],
                                }))
                              );

                              if (hadContent) {
                                toast("Point removed", {
                                  action: {
                                    label: "Undo",
                                    onClick: () =>
                                      onChange((sections) =>
                                        updateSection(sections, section.id, (item) => ({
                                          ...item,
                                          points: wasOnlyPoint
                                            ? [removedPoint]
                                            : [
                                                ...item.points.slice(0, removedIndex),
                                                removedPoint,
                                                ...item.points.slice(removedIndex),
                                              ],
                                        }))
                                      ),
                                  },
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {section.layout === "list" && point.children.length > 0 && (
                          <div className="ml-12 space-y-1.5">
                            {point.children.map((child, childIndex) => (
                              <div key={child.id} className="flex items-center gap-2">
                                <div className="w-14 shrink-0 text-xs font-bold text-muted-foreground">
                                  {sectionIndex + 1}.{pointIndex + 1}.{childIndex + 1}
                                </div>

                                <Input
                                  value={child.text}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    onChange((sections) =>
                                      updateSection(sections, section.id, (item) => ({
                                        ...item,
                                        points: updatePoint(item.points, point.id, (parent) => ({
                                          ...parent,
                                          children: updatePoint(parent.children, child.id, { text: value }),
                                        })),
                                      }))
                                    );
                                  }}
                                  placeholder="Sub-point..."
                                  aria-label={`Section ${sectionIndex + 1}, point ${pointIndex + 1}, sub-point ${childIndex + 1}`}
                                  className={`h-8 text-sm ${fieldControlClass}`}
                                />

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Remove sub-point ${sectionIndex + 1}.${pointIndex + 1}.${childIndex + 1}`}
                                  title={`Remove sub-point ${sectionIndex + 1}.${pointIndex + 1}.${childIndex + 1}`}
                                  className={cn(iconButtonSizeClass, "text-muted-foreground hover:text-destructive")}
                                  onClick={() => {
                                    const hadContent = Boolean(child.text.trim());
                                    const removedChild = child;
                                    const removedIndex = childIndex;

                                    onChange((sections) =>
                                      updateSection(sections, section.id, (item) => ({
                                        ...item,
                                        points: updatePoint(item.points, point.id, (parent) => ({
                                          ...parent,
                                          children: parent.children.filter((c) => c.id !== child.id),
                                        })),
                                      }))
                                    );

                                    if (hadContent) {
                                      toast("Sub-point removed", {
                                        action: {
                                          label: "Undo",
                                          onClick: () =>
                                            onChange((sections) =>
                                              updateSection(sections, section.id, (item) => ({
                                                ...item,
                                                points: updatePoint(item.points, point.id, (parent) => ({
                                                  ...parent,
                                                  children: [
                                                    ...parent.children.slice(0, removedIndex),
                                                    removedChild,
                                                    ...parent.children.slice(removedIndex),
                                                  ],
                                                })),
                                              }))
                                            ),
                                        },
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Add another sub-point under ${sectionIndex + 1}.${pointIndex + 1}`}
                              title={`Add another sub-point under ${sectionIndex + 1}.${pointIndex + 1}`}
                              className={cn(iconButtonSizeClass, "ml-14 text-muted-foreground hover:text-brand-teal")}
                              onClick={() =>
                                onChange((sections) =>
                                  updateSection(sections, section.id, (item) => ({
                                    ...item,
                                    points: updatePoint(item.points, point.id, (parent) => ({
                                      ...parent,
                                      children: [...parent.children, makeAgendaPoint()],
                                    })),
                                  }))
                                )
                              }
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  )}

                  {expanded && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-brand-teal hover:text-brand-teal"
                    onClick={() =>
                      onChange((sections) =>
                        updateSection(sections, section.id, (item) => ({
                          ...item,
                          points: [...item.points, makeAgendaPoint()],
                        }))
                      )
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add agenda point
                  </Button>
                  )}
                </div>
              </div>
            </Card>
            );
          })}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/70 px-5 py-4 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onChange((sections) => [...sections, makeAgendaSection()])}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
          <Button type="button" className="actsix-btn-primary min-h-10 rounded-xl" onClick={onSave}>
            Save Agenda
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
