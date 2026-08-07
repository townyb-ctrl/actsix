import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fieldControlClass } from "@/components/ui/field";
import {
  makeAgendaPoint,
  makeAgendaSection,
  type AgendaPoint,
  type AgendaSection,
  type AgendaSectionLayout,
} from "@/features/meetings/lib/meetingAgenda";

export type MeetingAgendaModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AgendaSection[];
  onChange: (updater: (sections: AgendaSection[]) => AgendaSection[]) => void;
  onSave: () => void;
  /** True when the meeting already has written minutes that a refill would replace. */
  minutesAtRisk?: boolean;
};

const LAYOUT_OPTIONS: { value: AgendaSectionLayout; label: string }[] = [
  { value: "list", label: "List" },
  { value: "dated", label: "Dated" },
  { value: "boxed", label: "Boxed" },
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="actsix-panel max-h-[86vh] max-w-3xl overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>Edit Agenda</DialogTitle>
          <DialogDescription>
            {minutesAtRisk
              ? "Build the agenda here. Your existing minutes stay exactly as they are — we'll ask first if you want to replace them."
              : "Build the agenda here. Saving will also fill the Minutes section with an outline to write into."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {draft.map((section, sectionIndex) => (
            <Card key={section.id} className="actsix-panel-soft p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-sm font-extrabold text-brand-teal">
                  {sectionIndex + 1}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={section.heading}
                      onChange={(event) => {
                        const value = event.target.value;
                        onChange((sections) => updateSection(sections, section.id, { heading: value }));
                      }}
                      placeholder="Section heading..."
                      aria-label={`Section ${sectionIndex + 1} heading`}
                      className={`font-semibold ${fieldControlClass}`}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove section ${sectionIndex + 1}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        onChange((sections) =>
                          sections.length > 1 ? sections.filter((item) => item.id !== section.id) : [makeAgendaSection()]
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 rounded-full border border-border/70 p-0.5">
                      {LAYOUT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={section.layout === option.value}
                          className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                            section.layout === option.value
                              ? "bg-brand-teal/10 text-brand-teal"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() =>
                            onChange((sections) => updateSection(sections, section.id, { layout: option.value }))
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <Input
                      value={section.tag}
                      onChange={(event) => {
                        const value = event.target.value;
                        onChange((sections) => updateSection(sections, section.id, { tag: value }));
                      }}
                      placeholder="Tag (optional), e.g. (Allan)"
                      aria-label={`Section ${sectionIndex + 1} tag`}
                      className={`h-8 max-w-[10rem] text-xs ${fieldControlClass}`}
                    />

                    <Input
                      value={section.subtitle}
                      onChange={(event) => {
                        const value = event.target.value;
                        onChange((sections) => updateSection(sections, section.id, { subtitle: value }));
                      }}
                      placeholder="Subtitle (optional)"
                      aria-label={`Section ${sectionIndex + 1} subtitle`}
                      className={`h-8 max-w-[14rem] text-xs italic ${fieldControlClass}`}
                    />
                  </div>

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
                            className={fieldControlClass}
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
                              className={`w-40 shrink-0 ${fieldControlClass}`}
                            />
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove point ${sectionIndex + 1}.${pointIndex + 1}`}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              onChange((sections) =>
                                updateSection(sections, section.id, (item) => ({
                                  ...item,
                                  points:
                                    item.points.length > 1
                                      ? item.points.filter((agendaPoint) => agendaPoint.id !== point.id)
                                      : [makeAgendaPoint()],
                                }))
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {section.layout === "list" && (
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
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    onChange((sections) =>
                                      updateSection(sections, section.id, (item) => ({
                                        ...item,
                                        points: updatePoint(item.points, point.id, (parent) => ({
                                          ...parent,
                                          children: parent.children.filter((c) => c.id !== child.id),
                                        })),
                                      }))
                                    )
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-lg text-xs text-muted-foreground hover:text-brand-teal"
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
                              <Plus className="h-3 w-3 mr-1" />
                              Add sub-point
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

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
                </div>
              </div>
            </Card>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
    </Dialog>
  );
}
