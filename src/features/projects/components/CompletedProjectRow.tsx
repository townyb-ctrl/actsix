import { FolderKanban } from "lucide-react";

import CollaboratorAvatars, {
  type TeamMember,
} from "@/features/projects/components/CollaboratorAvatars";
import { projectIconClass } from "@/features/projects/lib/projectPresentation";

type RowProject = {
  id: string;
  name: string;
  area?: string | null;
  cover_image_url?: string | null;
};

type CompletedProjectRowProps = {
  project: RowProject;
  owner?: TeamMember | null;
  collaborators?: TeamMember[];
  /** Drives the rotating icon tint on projects with no cover. */
  index: number;
  onOpen: () => void;
};

/**
 * Completed projects are archive material - you scan them for a name, you don't
 * evaluate them. A dense row fits far more per screen than the cover cards used
 * for active work.
 */
const CompletedProjectRow = ({
  project,
  owner,
  collaborators,
  index,
  onOpen,
}: CompletedProjectRowProps) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label={`Open project ${project.name}`}
    className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-border/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30"
  >
    <div className="h-8 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
      {project.cover_image_url ? (
        <img
          src={project.cover_image_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${projectIconClass(index)}`}
        >
          <FolderKanban className="h-4 w-4 opacity-70" />
        </div>
      )}
    </div>

    <span className="min-w-0 flex-1 truncate text-sm font-bold" title={project.name}>
      {project.name}
    </span>

    <span className="hidden min-w-0 shrink-0 truncate text-xs font-semibold text-muted-foreground sm:block">
      {project.area || "General"}
    </span>

    <span className="hidden min-w-0 max-w-[10rem] shrink-0 truncate text-xs font-semibold text-muted-foreground md:block">
      {owner?.display_name || "Unassigned"}
    </span>

    <CollaboratorAvatars collaborators={collaborators} excludeId={owner?.id} max={3} />
  </button>
);

export default CompletedProjectRow;
