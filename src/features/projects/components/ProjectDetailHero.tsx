import { CalendarDays, Clock3, Edit3, FolderKanban, ImagePlus, MoreHorizontal, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type TeamMember } from "@/features/projects/components/CollaboratorAvatars";
import { projectIconClass, statusClass } from "@/features/projects/lib/projectPresentation";

type HeroProject = {
  name: string;
  area?: string | null;
  status?: string | null;
  banner_image_url?: string | null;
  due_date?: string | null;
  is_event?: boolean | null;
  event_start_at?: string | null;
};

type ProjectDetailHeroProps = {
  project: HeroProject;
  owner?: TeamMember | null;
  progress: number;
  openCount: number;
  doneCount: number;
  /** Opens the banner picker. Omitted when the viewer can't edit the project. */
  onChangeBanner?: () => void;
  onEditProject?: () => void;
  onDeleteProject?: () => void;
};

// Short strip, not the grid card's aspect ratio - the banner needs its own,
// narrower image rather than reusing the cover upload.
const RECOMMENDED_BANNER_SIZE = "1600 × 130px";

const formatProjectDate = (value?: string | null) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * This banner is its own upload, separate from the cover shown on the
 * Projects grid card - the hero strip is much shorter, so it needs its own
 * recommended size rather than reusing the cover's.
 * The name lives in the PageHeader above this, so the hero deliberately
 * doesn't repeat it.
 */
const ProjectDetailHero = ({
  project,
  owner,
  progress,
  openCount,
  doneCount,
  onChangeBanner,
  onEditProject,
  onDeleteProject,
}: ProjectDetailHeroProps) => {
  const eventDate = project.is_event ? formatProjectDate(project.event_start_at) : "";
  const dueDate = eventDate ? "" : formatProjectDate(project.due_date);
  const hasMenu = Boolean(onChangeBanner || onEditProject || onDeleteProject);

  return (
    <div className="actsix-panel overflow-hidden">
      <div className="relative h-20 w-full overflow-hidden bg-muted sm:h-28">
        {project.banner_image_url ? (
          <img
            src={project.banner_image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className={`flex h-full w-full flex-col items-center justify-center gap-0.5 ${projectIconClass(0)}`}>
            <FolderKanban className="h-6 w-6 opacity-70" />
            {onChangeBanner && (
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
                Recommended {RECOMMENDED_BANNER_SIZE}
              </span>
            )}
          </div>
        )}

        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Project actions for ${project.name}`}
                className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {onChangeBanner && (
                <DropdownMenuItem onClick={onChangeBanner}>
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Change banner image
                </DropdownMenuItem>
              )}
              {onEditProject && (
                <DropdownMenuItem onClick={onEditProject}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit project
                </DropdownMenuItem>
              )}
              {onDeleteProject && (
                <DropdownMenuItem
                  onClick={onDeleteProject}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete project
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Progress reads as a hairline on the image edge, matching the cards on
            the Projects grid. The number is spelled out in the meta row below. */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
          <div
            className="h-full bg-brand-teal transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`chip shrink-0 px-2 py-0.5 text-[10px] ${statusClass(project.status)}`}>
            {project.status || "In Progress"}
          </span>

          <span className="min-w-0 truncate text-sm">
            <span className="font-semibold text-muted-foreground">Owner: </span>
            <span className="font-bold text-foreground">
              {owner?.display_name || "Unassigned"}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-semibold text-muted-foreground">
          {(eventDate || dueDate) && (
            <span className="inline-flex items-center gap-1.5">
              {eventDate ? (
                <CalendarDays className="h-3.5 w-3.5 text-brand-sage" />
              ) : (
                <Clock3 className="h-3.5 w-3.5 text-brand-sage" />
              )}
              {eventDate ? `Event ${eventDate}` : `Due ${dueDate}`}
            </span>
          )}

          <span className="tabular-nums">
            <strong className="text-foreground">{progress}%</strong> ·{" "}
            <strong className="text-foreground">{openCount}</strong> open ·{" "}
            <strong className="text-foreground">{doneCount}</strong> done
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailHero;
