import { CalendarDays, Clock3, FolderKanban, ImagePlus } from "lucide-react";

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
};

// Same dimensions as the Projects grid card upload, so one image works for
// both - the banner strip just crops it tighter top-to-bottom.
const RECOMMENDED_BANNER_SIZE = "1600 × 600px";

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
 * Projects grid card, but recommended at the same dimensions so one image
 * can be reused for both - the short banner strip just crops it tighter.
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
}: ProjectDetailHeroProps) => {
  const eventDate = project.is_event ? formatProjectDate(project.event_start_at) : "";
  const dueDate = eventDate ? "" : formatProjectDate(project.due_date);

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

        {onChangeBanner && (
          <button
            type="button"
            onClick={onChangeBanner}
            aria-label={`Change banner image for ${project.name}`}
            title={`Change banner image (recommended ${RECOMMENDED_BANNER_SIZE})`}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
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
                <CalendarDays className="h-3.5 w-3.5 text-brand-amber" />
              ) : (
                <Clock3 className="h-3.5 w-3.5 text-brand-amber" />
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
