import { PersonAvatar } from "@/components/people/PersonAvatar";

export type TeamMember = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
};

type CollaboratorAvatarsProps = {
  collaborators?: TeamMember[];
  /**
   * Usually the owner's id. The owner is named in text alongside this stack and
   * is normally also a project_collaborators row, so without this they appear
   * twice.
   */
  excludeId?: string | null;
  /** Faces shown before the tail collapses into a "+N". */
  max?: number;
};

const CollaboratorAvatars = ({
  collaborators = [],
  excludeId,
  max = 4,
}: CollaboratorAvatarsProps) => {
  const seen = new Set<string>();
  const team = collaborators.filter((person) => {
    if (person.id === excludeId || seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });

  if (team.length === 0) return null;

  const shown = team.slice(0, max);
  const overflow = team.length - shown.length;
  const label = team.map((person) => person.display_name).join(", ");

  return (
    <div className="flex shrink-0 items-center" title={label}>
      <div className="flex -space-x-2">
        {shown.map((person) => (
          <PersonAvatar
            key={person.id}
            name={person.display_name}
            avatarUrl={person.avatar_url}
            size="sm"
            className="ring-2 ring-background"
          />
        ))}
      </div>

      {overflow > 0 && (
        <span className="ml-2 text-xs font-bold text-muted-foreground">
          +{overflow}
        </span>
      )}

      <span className="sr-only">Collaborators: {label}</span>
    </div>
  );
};

export default CollaboratorAvatars;
