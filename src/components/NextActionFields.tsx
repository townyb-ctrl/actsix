import { useEffect, useId, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
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
  showOrganization?: boolean;
  variant?: "default" | "inbox";
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
  showOrganization = true,
  variant = "default",
}: NextActionFieldsProps) => {
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();

  const fieldId = useId();
  const projectFieldId = `${fieldId}-project`;
  const dueFieldId = `${fieldId}-due`;
  const durationFieldId = `${fieldId}-duration`;
  const energyFieldId = `${fieldId}-energy`;
  const priorityFieldId = `${fieldId}-priority`;
  const contextFieldId = `${fieldId}-context`;
  const tagsFieldId = `${fieldId}-tags`;

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

  const durationOptions = [2, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120];
  const inputClassName =
    variant === "inbox"
      ? "h-8 rounded-lg border-border/70 bg-card text-base shadow-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
      : "h-8 rounded-lg border-border/70 bg-background text-base shadow-none sm:text-xs";
  const selectClassName =
    variant === "inbox"
      ? "h-8 w-full rounded-lg border border-border/70 bg-card px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
      : "h-8 w-full rounded-lg border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs";
  const fieldWrapperClassName = "space-y-1";
  const labelClassName = "label-eyebrow flex items-center gap-1.5 text-[0.65rem]";

  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-brand-teal" />
          <h3 className="text-sm font-extrabold tracking-tight">Next Action details</h3>
        </div>

        <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 sm:grid-cols-3">
          <div className={fieldWrapperClassName}>
            <label htmlFor={projectFieldId} className={labelClassName}>Project</label>
            <ProjectSelect
              id={projectFieldId}
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
              selectClassName={selectClassName}
            />
          </div>

          <div className={fieldWrapperClassName}>
            <label htmlFor={dueFieldId} className={labelClassName}>Due date</label>
            <Input
              id={dueFieldId}
              type="date"
              value={item.due ?? ""}
              onChange={(event) =>
                onChange({ ...item, due: event.target.value || null })
              }
              className={inputClassName}
            />
          </div>

          <div className={fieldWrapperClassName}>
            <label htmlFor={durationFieldId} className={labelClassName}>Est. Duration</label>
            <select
              id={durationFieldId}
              value={item.minutes ?? 15}
              onChange={(event) =>
                onChange({
                  ...item,
                  minutes: Number(event.target.value) || 15,
                })
              }
              className={selectClassName}
            >
              {durationOptions.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </div>

          <div className={fieldWrapperClassName}>
            <label htmlFor={energyFieldId} className={labelClassName}>Energy</label>
            <select
              id={energyFieldId}
              value={item.energy ?? "Medium"}
              onChange={(event) =>
                onChange({ ...item, energy: event.target.value })
              }
              className={selectClassName}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>

          <div className={fieldWrapperClassName}>
            <label htmlFor={priorityFieldId} className={labelClassName}>Priority</label>
            <select
              id={priorityFieldId}
              value={item.priority ?? "Medium"}
              onChange={(event) =>
                onChange({ ...item, priority: event.target.value })
              }
              className={selectClassName}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </div>

          <div className={fieldWrapperClassName}>
            <label htmlFor={contextFieldId} className={labelClassName}>Context</label>
            <ContextSelect
              id={contextFieldId}
              value={item.context ?? "General"}
              onChange={(context) => onChange({ ...item, context })}
              onCreated={onRefreshOptions}
              selectClassName={selectClassName}
            />
          </div>

          {shouldShowAssignedTo && (
            <div className={`${fieldWrapperClassName} col-span-2 sm:col-span-3`}>
              <label className={labelClassName}>Assigned To</label>
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
                compact
              />
              <p className="text-xs text-muted-foreground">
                Only project collaborators can be assigned.
              </p>
            </div>
          )}

          {!loadingCollaborators &&
            Boolean(String(selectedProjectName || "").trim()) &&
            currentProject &&
            canAssignProjectTasks &&
            assignablePeople.length === 0 && (
              <p className="col-span-2 text-xs text-muted-foreground sm:col-span-3">
                Add collaborators to this project before assigning tasks.
              </p>
            )}

          {showOrganization && (
            <div className={`${fieldWrapperClassName} col-span-2 sm:col-span-3`}>
              <label htmlFor={tagsFieldId} className={labelClassName}>Tags</label>
              <Input
                id={tagsFieldId}
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
                className={inputClassName}
                placeholder="Worship, Admin, Follow-up"
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default NextActionFields;
