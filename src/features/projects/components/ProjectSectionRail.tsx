import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export type RailSection = {
  id: string;
  name: string;
  openCount: number;
};

type ProjectSectionRailProps = {
  sections: RailSection[];
  /** Section id, or the "all tasks" sentinel. */
  activeId: string;
  allId: string;
  allOpenCount: number;
  onSelect: (id: string) => void;
  /** Omitted while the project_sections migration is missing. */
  onAddSection?: () => void;
};

/**
 * Workstream switcher for the project detail page. One markup for both shapes:
 * a scrollable strip of chips on phones, a vertical rail from lg up.
 */
const ProjectSectionRail = ({
  sections,
  activeId,
  allId,
  allOpenCount,
  onSelect,
  onAddSection,
}: ProjectSectionRailProps) => {
  const entries = [{ id: allId, name: "All tasks", openCount: allOpenCount }, ...sections];

  return (
    <div className="lg:sticky lg:top-4">
      <nav
        aria-label="Project sections"
        className="actsix-view-tabs flex gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] lg:flex-col lg:overflow-visible"
      >
        {entries.map((entry) => {
          const active = entry.id === activeId;

          return (
            <button
              key={entry.id}
              type="button"
              data-state={active ? "active" : "inactive"}
              aria-current={active ? "true" : undefined}
              className="actsix-view-tab shrink-0 lg:w-full"
              onClick={() => onSelect(entry.id)}
            >
              <span className="truncate text-[13px] font-bold">{entry.name}</span>
              <span className="actsix-view-tab-count">{entry.openCount}</span>
            </button>
          );
        })}
      </nav>

      {onAddSection && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-8 w-full justify-start px-3 text-xs font-bold text-muted-foreground hover:text-brand-teal"
          onClick={onAddSection}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Section
        </Button>
      )}
    </div>
  );
};

export default ProjectSectionRail;
