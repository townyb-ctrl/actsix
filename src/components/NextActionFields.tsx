import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Tags, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import ProjectSelect from "@/components/ProjectSelect";
import ContextSelect from "@/components/ContextSelect";
import { PeopleSearchSelect, type PeopleSearchPerson } from "@/components/people/PeopleSearchSelect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";

type NextActionFieldsProps = {
  item: any;
  onChange: (item: any) => void;
  onRefreshOptions?: () => void | Promise<void>;
};

type ProjectRecord = {
  id: string;
  name: string;
  user_id: string;
};

type ProjectCollaborator = {
  person_id: string;
  people?: PeopleSearchPerson | null;
};

const NextActionFields = ({
  item,
  onChange,
  onRefreshOptions,
}: NextActionFieldsProps) => {
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();

  const [currentProject, setCurrentProject] = useState<ProjectRecord | null>(null);
  const [projectCollaborators, setProjectCollaborators] = useState<ProjectCollaborator[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);

  const selectedProjectName = item?.project || "";
  const selectedProjectId = item?.project_id || "";

  useEffect(() => {
    const loadProjectCollaborators = async () => {
      const cleanProjectName = String(selectedProjectName || "").trim();

      if (!user || (!cleanProjectName && !selectedProjectId)) {
        setCurrentProject(null);
        setProjectCollaborators([]);
        return;
      }

      setLoadingCollaborators(true);

      let projectQuery = (supabase as any)
        .from("projects")
        .select("id, name, user_id")
        .order("updated_at", { ascending: false })
        .limit(1);

      projectQuery = selectedProjectId
        ? projectQuery.eq("id", selectedProjectId)
        : projectQuery.ilike("name", cleanProjectName);

      const { data: projectRows, error: projectError } = await projectQuery;

      const projectData = projectRows?.[0] || null;

      if (projectError || !projectData) {
        setCurrentProject(null);
        setProjectCollaborators([]);
        setLoadingCollaborators(false);
        return;
      }

      setCurrentProject(projectData);

      const { data: collaboratorData, error: collaboratorError } = await (supabase as any)
        .from("project_collaborators")
        .select("person_id, people(id, display_name, avatar_url, email, phone_number)")
        .eq("project_id", projectData.id);

      if (collaboratorError) {
        setProjectCollaborators([]);
        setLoadingCollaborators(false);
        return;
      }

      setProjectCollaborators(collaboratorData || []);
      setLoadingCollaborators(false);
    };

    loadProjectCollaborators();
  }, [user?.id, selectedProjectName, selectedProjectId]);

  const assignablePeople = useMemo(() => {
    return projectCollaborators
      .map((collaborator) => collaborator.people)
      .filter(Boolean) as PeopleSearchPerson[];
  }, [projectCollaborators]);

  const canAssignProjectTasks = useMemo(() => {
    if (!user || !currentProject) return false;

    const isProjectOwner = currentProject.user_id === user.id;
    const isProjectCollaborator =
      Boolean(currentPerson?.id) &&
      projectCollaborators.some((collaborator) => collaborator.person_id === currentPerson?.id);

    return isProjectOwner || isProjectCollaborator;
  }, [user, currentProject, currentPerson?.id, projectCollaborators]);

  const shouldShowAssignedTo =
    Boolean(selectedProjectName) &&
    assignablePeople.length > 0 &&
    canAssignProjectTasks;

  if (!item) return null;

  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-brand-teal" />
          <h3 className="font-extrabold tracking-tight">Next Action details</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <label className="label-eyebrow">Project</label>
            <ProjectSelect
              value={item.project ?? ""}
              onChange={(project) =>
                onChange({
                  ...item,
                  project,
                  assigned_person_id:
                    String(project || "").trim() === String(item.project || "").trim()
                      ? item.assigned_person_id ?? null
                      : null,
                })
              }
              onProjectChange={(project) =>
                onChange({
                  ...item,
                  project: project?.name ?? item.project ?? "",
                  project_id: project?.id ?? null,
                  assigned_person_id:
                    project?.id === item.project_id
                      ? item.assigned_person_id ?? null
                      : null,
                })
              }
              onCreated={onRefreshOptions}
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <label className="label-eyebrow">Context</label>
            <ContextSelect
              value={item.context ?? "General"}
              onChange={(context) => onChange({ ...item, context })}
              onCreated={onRefreshOptions}
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <label className="label-eyebrow flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Duration
            </label>
            <Input
              type="number"
              min="1"
              value={item.minutes ?? 15}
              onChange={(event) =>
                onChange({
                  ...item,
                  minutes: Number(event.target.value) || 15,
                })
              }
              className="mt-2 h-10 rounded-xl border-border/70 bg-background shadow-none"
            />
          </div>

          {shouldShowAssignedTo && (
            <div className="rounded-xl border border-border/70 bg-background/70 p-4 md:col-span-2">
              <label className="label-eyebrow flex items-center gap-2">
                <UserRound className="h-3.5 w-3.5" />
                Assigned To
              </label>
              <div className="mt-2">
                <PeopleSearchSelect
                  people={assignablePeople}
                  selectedPersonId={item.assigned_person_id ?? ""}
                  onSelect={(personId) =>
                    onChange({
                      ...item,
                      assigned_person_id: personId || null,
                    })
                  }
                  placeholder="Search project collaborators..."
                  emptyText="No matching project collaborators found."
                  showAllOnFocus
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Tasks can only be assigned to People who are collaborators on this project.
              </p>
            </div>
          )}

          {!loadingCollaborators &&
            Boolean(String(selectedProjectName || "").trim()) &&
            currentProject &&
            canAssignProjectTasks &&
            assignablePeople.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground md:col-span-2">
                Add collaborators to this project before assigning tasks.
              </div>
            )}

          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <label className="label-eyebrow">Priority</label>
            <select
              value={item.priority ?? "Medium"}
              onChange={(event) =>
                onChange({ ...item, priority: event.target.value })
              }
              className="mt-2 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <label className="label-eyebrow">Energy</label>
            <select
              value={item.energy ?? "Medium"}
              onChange={(event) =>
                onChange({ ...item, energy: event.target.value })
              }
              className="mt-2 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <label className="label-eyebrow">Due date</label>
            <Input
              type="date"
              value={item.due ?? ""}
              onChange={(event) =>
                onChange({ ...item, due: event.target.value || null })
              }
              className="mt-2 h-10 rounded-xl border-border/70 bg-background shadow-none"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Tags className="h-4 w-4 text-brand-teal" />
          <h3 className="font-extrabold tracking-tight">Organization</h3>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/70 p-4">
          <label className="label-eyebrow">Tags</label>
          <Input
            value={Array.isArray(item.tags) ? item.tags.join(", ") : ""}
            onChange={(event) =>
              onChange({
                ...item,
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
            className="mt-2 h-10 rounded-xl border-border/70 bg-background shadow-none"
            placeholder="Worship, Admin, Follow-up"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Separate tags with commas.
          </p>
        </div>
      </section>
    </>
  );
};

export default NextActionFields;
