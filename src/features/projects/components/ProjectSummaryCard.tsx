import { FolderKanban, ImagePlus } from "lucide-react";

import { projectIconClass } from "@/features/projects/lib/projectPresentation";
import CollaboratorAvatars, { type TeamMember } from "@/features/projects/components/CollaboratorAvatars";

type SummaryProject = {
  id: string;
  name: string;
  area?: string | null;
  status?: string | null;
  cover_image_url?: string | null;
};

type SummaryStats = {
  progress: number;
  openTasks: unknown[];
};

type ProjectSummaryCardProps = {
  project: SummaryProject;
  stats?: SummaryStats;
  owner?: TeamMember | null;
  collaborators?: TeamMember[];
  /** Drives the rotating icon tint so a wall of coverless projects reads as varied. */
  index: number;
  onOpen: () => void;
  /** Opens the cover picker. Omitted when the viewer can't edit the project. */
  onChangeCover?: () => void;
};

const ProjectSummaryCard = ({
  project,
  stats,
  owner,
  collaborators,
  index,
  onOpen,
  onChangeCover,
}: ProjectSummaryCardProps) => {
  const progress = stats?.progress ?? 0;
  const openCount = stats?.openTasks.length ?? 0;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open project ${project.name}`}
        className="actsix-interactive-tile flex h-full w-full flex-col overflow-hidden p-0 text-left"
      >
        {/* Fixed aspect ratio so a grid of covers stays on a rhythm no matter
            what people upload. */}
        <div className="relative aspect-[16/6] w-full overflow-hidden bg-muted">
          {project.cover_image_url ? (
            <img
              src={project.cover_image_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center ${projectIconClass(index)}`}
            >
              <FolderKanban className="h-8 w-8 opacity-70" />
            </div>
          )}

          {/* Progress reads as a hairline on the image edge rather than a
              labelled bar - it's ambient here, not the reason you're looking. */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
            <div
              className="h-full bg-brand-teal transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-5">
          <h2
            className="line-clamp-2 text-2xl font-extrabold leading-[1.15] tracking-tight"
            title={project.name}
          >
            {project.name}
          </h2>

          <p className="truncate text-[13px] font-semibold text-muted-foreground">
            {project.area || "General"} · {openCount} open
          </p>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/50 pt-3.5">
            <span className="min-w-0 truncate text-sm">
              <span className="font-semibold text-muted-foreground">Owner: </span>
              <span className="font-bold text-foreground">
                {owner?.display_name || "Unassigned"}
              </span>
            </span>

            <CollaboratorAvatars collaborators={collaborators} excludeId={owner?.id} />
          </div>
        </div>
      </button>

      {onChangeCover && (
        <button
          type="button"
          onClick={onChangeCover}
          aria-label={`Change cover image for ${project.name}`}
          title="Change cover image"
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-background/85 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default ProjectSummaryCard;
