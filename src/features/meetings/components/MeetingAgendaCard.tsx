import { useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, type AgendaSection } from "@/features/meetings/lib/meetingAgenda";

// Matches Button's own focus-visible treatment - the section rows below are
// raw <button>s (not <Button>) so they need it spelled out explicitly, or
// keyboard focus on them is invisible.
const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";

export type MeetingAgendaCardProps = {
  sections: AgendaSection[];
  onEdit: () => void;
};

const writtenPoints = (section: AgendaSection) => section.points.filter((point) => point.text.trim());

/**
 * The saved agenda, read-only, beside the minutes rather than behind a modal.
 *
 * The agenda is the plan and the minutes are the record, and the whole reason
 * this sits in the sidebar is so someone writing up point 1.2 can see what 1.2
 * actually was without leaving what they're typing. It carries the same
 * numbering the generated minutes use, so the two read as one document.
 */
export function MeetingAgendaCard({ sections, onEdit }: MeetingAgendaCardProps) {
  // Headings only by default - a real agenda runs to 7+ sections and this
  // column is 340px wide, so opening everything would bury People and Action
  // Points below the fold. A single section opens on click.
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(new Set());

  const toggle = (sectionId: string) =>
    setOpenSectionIds((ids) => {
      const next = new Set(ids);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });

  const written = sections.filter(
    (section) => section.heading.trim() || writtenPoints(section).length
  );

  return (
    <Card className="actsix-panel overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-background/55 px-4 py-3">
        <h2 className="pt-0.5 text-base font-extrabold tracking-tight">Agenda</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 shrink-0 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal sm:h-8"
          onClick={onEdit}
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      {written.length === 0 ? (
        <div className="p-4">
          <p className="actsix-empty-state">
            No agenda yet. Build one and the minutes fill in with an outline to write into.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {written.map((section, sectionIndex) => {
            const points = writtenPoints(section);
            const expanded = openSectionIds.has(section.id);

            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  aria-expanded={expanded}
                  className={cn(
                    "flex w-full items-start gap-2 px-4 py-2.5 text-left transition hover:bg-brand-teal/5",
                    focusRingClass
                  )}
                >
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                      expanded ? "rotate-0" : "-rotate-90"
                    )}
                  />
                  <span className="shrink-0 pt-px text-xs font-extrabold tabular-nums text-muted-foreground">
                    {sectionIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-snug">
                      {section.heading.trim() || (
                        <span className="italic text-muted-foreground">Untitled section</span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                    {points.length}
                  </span>
                </button>

                {expanded && points.length > 0 && (
                  <ul className="space-y-1.5 pb-3 pl-[3.1rem] pr-4">
                    {points.map((point, pointIndex) => (
                      <li key={point.id}>
                        <div className="flex gap-2 text-xs leading-snug">
                          <span className="shrink-0 font-bold tabular-nums text-muted-foreground">
                            {sectionIndex + 1}.{pointIndex + 1}
                          </span>
                          <span className="min-w-0 flex-1">{point.text.trim()}</span>
                          {section.layout === "dated" && point.date && (
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {formatDate(point.date)}
                            </span>
                          )}
                        </div>

                        {point.children.filter((child) => child.text.trim()).length > 0 && (
                          <ul className="mt-1 space-y-1 border-l border-border/60 pl-2.5">
                            {point.children
                              .filter((child) => child.text.trim())
                              .map((child, childIndex) => (
                                <li key={child.id} className="flex gap-2 text-xs leading-snug text-muted-foreground">
                                  <span className="shrink-0 font-bold tabular-nums">
                                    {sectionIndex + 1}.{pointIndex + 1}.{childIndex + 1}
                                  </span>
                                  <span className="min-w-0 flex-1">{child.text.trim()}</span>
                                </li>
                              ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
