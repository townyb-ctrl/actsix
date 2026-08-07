import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fieldControlClass } from "@/components/ui/field";
import { makeAgendaPoint, makeAgendaSection, type AgendaSection } from "@/features/meetings/lib/meetingAgenda";

export type MeetingAgendaModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AgendaSection[];
  onChange: (updater: (sections: AgendaSection[]) => AgendaSection[]) => void;
  onSave: () => void;
  /** True when the meeting already has written minutes that a refill would replace. */
  minutesAtRisk?: boolean;
};

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
                      onChange={(event) =>
                        onChange((sections) =>
                          sections.map((item) =>
                            item.id === section.id ? { ...item, heading: event.target.value } : item
                          )
                        )
                      }
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
                          sections.length > 1
                            ? sections.filter((item) => item.id !== section.id)
                            : [makeAgendaSection()]
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {section.points.map((point, pointIndex) => (
                      <div key={point.id} className="flex items-center gap-2">
                        <div className="w-10 shrink-0 text-xs font-bold text-muted-foreground">
                          {sectionIndex + 1}.{pointIndex + 1}
                        </div>

                        <Input
                          value={point.text}
                          onChange={(event) =>
                            onChange((sections) =>
                              sections.map((item) =>
                                item.id === section.id
                                  ? {
                                      ...item,
                                      points: item.points.map((agendaPoint) =>
                                        agendaPoint.id === point.id
                                          ? { ...agendaPoint, text: event.target.value }
                                          : agendaPoint
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          placeholder="Agenda point..."
                          aria-label={`Section ${sectionIndex + 1}, point ${pointIndex + 1}`}
                          className={fieldControlClass}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove point ${sectionIndex + 1}.${pointIndex + 1}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            onChange((sections) =>
                              sections.map((item) =>
                                item.id === section.id
                                  ? {
                                      ...item,
                                      points:
                                        item.points.length > 1
                                          ? item.points.filter((agendaPoint) => agendaPoint.id !== point.id)
                                          : [makeAgendaPoint()],
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
                        sections.map((item) =>
                          item.id === section.id
                            ? { ...item, points: [...item.points, makeAgendaPoint()] }
                            : item
                        )
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
