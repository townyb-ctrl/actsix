import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { type TeamMember } from "@/features/projects/components/CollaboratorAvatars";

type SidebarCollaborator = {
  id: string;
  role: string | null;
  person: TeamMember | null;
};

type SidebarActivity = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  person: TeamMember | null;
};

type ProjectDetailSidebarProps = {
  owner?: TeamMember | null;
  collaborators: SidebarCollaborator[];
  onAddCollaborator: () => void;
  onRemoveCollaborator: (collaboratorId: string) => void;
  activity: SidebarActivity[];
};

const ACTIVITY_PREVIEW_COUNT = 4;

const ProjectDetailSidebar = ({
  owner,
  collaborators,
  onAddCollaborator,
  onRemoveCollaborator,
  activity,
}: ProjectDetailSidebarProps) => {
  const [showAllActivity, setShowAllActivity] = useState(false);

  const visibleActivity = showAllActivity
    ? activity
    : activity.slice(0, ACTIVITY_PREVIEW_COUNT);

  return (
    <div className="min-w-0 space-y-3">
      <section className="actsix-panel p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="label-eyebrow">People</h2>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-bold text-muted-foreground hover:text-brand-teal"
            onClick={onAddCollaborator}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        <ul className="mt-2 space-y-0.5">
          {owner && (
            <li className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
              <PersonAvatar
                name={owner.display_name}
                avatarUrl={owner.avatar_url}
                size="sm"
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {owner.display_name}
                </span>
                <span className="block text-[11px] font-semibold text-muted-foreground">
                  Owner
                </span>
              </span>
            </li>
          )}

          {collaborators
            .filter((collaborator) => collaborator.person?.id !== owner?.id)
            .map((collaborator) => (
              <li
                key={collaborator.id}
                className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5"
              >
                <PersonAvatar
                  name={collaborator.person?.display_name}
                  avatarUrl={collaborator.person?.avatar_url}
                  size="sm"
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {collaborator.person?.display_name || "Person"}
                  </span>
                  <span className="block text-[11px] font-semibold text-muted-foreground">
                    {collaborator.role || "Collaborator"}
                  </span>
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  title={`Remove ${collaborator.person?.display_name || "person"}`}
                  aria-label={`Remove ${collaborator.person?.display_name || "person"} from this project`}
                  onClick={() => onRemoveCollaborator(collaborator.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
        </ul>

        {!owner && collaborators.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            No one is on this project yet. Add the people carrying the work.
          </p>
        )}
      </section>

      <section className="actsix-panel p-4">
        <h2 className="label-eyebrow">Activity</h2>

        {activity.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Task changes and project updates will show up here.
          </p>
        ) : (
          <>
            <ul className="mt-2 space-y-2.5">
              {visibleActivity.map((entry) => (
                <li key={entry.id} className="flex gap-2.5">
                  <PersonAvatar
                    name={entry.person?.display_name || "ACTSIX"}
                    avatarUrl={entry.person?.avatar_url}
                    size="xs"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold leading-tight">
                      {entry.title}
                    </p>

                    {entry.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {entry.description}
                      </p>
                    )}

                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {activity.length > ACTIVITY_PREVIEW_COUNT && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 px-2 text-xs font-bold text-muted-foreground hover:text-brand-teal"
                onClick={() => setShowAllActivity((open) => !open)}
              >
                {showAllActivity ? "Show less" : `Show all ${activity.length}`}
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default ProjectDetailSidebar;
