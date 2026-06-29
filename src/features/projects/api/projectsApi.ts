import { supabase } from "@/integrations/supabase/client";

const EMPTY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export const getProjects = () =>
  supabase.from("projects").select("*").order("updated_at", { ascending: false });

export const getProject = (projectId: string) =>
  supabase.from("projects").select("*").eq("id", projectId).single();

export const getProjectTasks = (projectId?: string) => {
  const query = supabase.from("tasks").select("*").order("created_at", { ascending: false });

  return projectId ? query.eq("project_id", projectId) : query;
};

export const getWorkspacePeople = (workspaceId?: string | null) =>
  (supabase as any)
    .from("people")
    .select("id, user_id, auth_user_id, display_name, avatar_url, email, phone_number")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("display_name", { ascending: true });

export const getWorkspacePersonOptions = (workspaceId?: string | null) =>
  (supabase as any)
    .from("people")
    .select("id, user_id, auth_user_id, display_name, avatar_url, email, phone_number")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .order("display_name", { ascending: true });

export const getProjectCollaborators = (projectId: string) =>
  (supabase as any)
    .from("project_collaborators")
    .select("id, user_id, project_id, person_id, role, created_at, people(id, user_id, display_name, avatar_url, email, phone_number)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

export const getProjectSections = (projectId: string) =>
  (supabase as any)
    .from("project_sections")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

export const getProjectActivityLogs = ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) =>
  (supabase as any)
    .from("activity_logs")
    .select("id, actor_person_id, entity_type, entity_id, action_type, title, description, metadata, created_at")
    .eq("user_id", userId)
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);

export const getPeopleByIds = ({
  workspaceId,
  personIds,
}: {
  workspaceId?: string | null;
  personIds: Array<string | null | undefined>;
}) =>
  (supabase as any)
    .from("people")
    .select("id, display_name, avatar_url")
    .eq("workspace_id", workspaceId ?? EMPTY_WORKSPACE_ID)
    .in("id", personIds.filter(Boolean));

export const createProject = (payload: Record<string, unknown>) =>
  supabase.from("projects").insert(payload as any);

export const updateProject = (projectId: string, payload: Record<string, unknown>) =>
  supabase.from("projects").update(payload as any).eq("id", projectId);

export const deleteProject = (projectId: string) =>
  supabase.from("projects").delete().eq("id", projectId);

export const updateProjectNotes = ({
  projectId,
  notes,
}: {
  projectId: string;
  notes: string;
}) =>
  updateProject(projectId, {
    notes,
    updated_at: new Date().toISOString(),
  });

export const addProjectCollaborators = ({
  userId,
  projectId,
  personIds,
  role = "Collaborator",
}: {
  userId: string;
  projectId: string;
  personIds: string[];
  role?: string;
}) =>
  (supabase as any).from("project_collaborators").insert(
    personIds.map((personId) => ({
      user_id: userId,
      project_id: projectId,
      person_id: personId,
      role,
    }))
  );

export const removeProjectCollaborator = ({
  collaboratorId,
  userId,
}: {
  collaboratorId: string;
  userId?: string;
}) =>
  (supabase as any)
    .from("project_collaborators")
    .delete()
    .eq("id", collaboratorId)
    .eq("user_id", userId);

export const upsertProjectSection = ({
  sectionId,
  userId,
  projectId,
  payload,
}: {
  sectionId?: string;
  userId: string;
  projectId: string;
  payload: Record<string, unknown>;
}) =>
  sectionId
    ? (supabase as any).from("project_sections").update(payload).eq("id", sectionId)
    : (supabase as any).from("project_sections").insert({
        ...payload,
        user_id: userId,
        project_id: projectId,
      });

export const deleteProjectSection = (sectionId: string) =>
  (supabase as any).from("project_sections").delete().eq("id", sectionId);

export const createProjectActionTask = (payload: Record<string, unknown>) =>
  supabase.from("tasks").insert(payload as any);

export const updateProjectActionTask = ({
  taskId,
  payload,
}: {
  taskId: string;
  payload: Record<string, unknown>;
}) => supabase.from("tasks").update(payload as any).eq("id", taskId);

export const updateProjectTaskCompletion = ({
  taskId,
  complete,
}: {
  taskId: string;
  complete: boolean;
}) =>
  updateProjectActionTask({
    taskId,
    payload: {
      complete,
      completed_at: complete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
  });

export const deleteProjectActionTask = (taskId: string) =>
  supabase.from("tasks").delete().eq("id", taskId);

export const updateProjectNameOnTasks = ({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}) =>
  supabase
    .from("tasks")
    .update({
      project: name,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);

export const upsertProjectCalendarEvent = async ({
  project,
  userId,
  workspaceId,
}: {
  project: Record<string, any>;
  userId: string;
  workspaceId: string;
}) => {
  const startsAt =
    project.is_event && project.event_start_at
      ? project.event_start_at
      : project.due_date
        ? `${project.due_date}T09:00:00`
        : null;

  if (!startsAt) {
    return { data: null, error: null };
  }

  const startDate = new Date(startsAt);
  const endDate = project.is_event && project.event_end_at
    ? new Date(project.event_end_at)
    : new Date(startDate.getTime() + 60 * 60 * 1000);

  const payload = {
    workspace_id: workspaceId,
    user_id: userId,
    title: project.is_event ? project.name : `Project due: ${project.name}`,
    calendar_name: "ACTSIX",
    source: "actsix",
    starts_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    all_day: !project.is_event,
    location: "",
    description: project.notes || "",
    status: project.status === "Completed" ? "Tentative" : "Confirmed",
    updated_at: new Date().toISOString(),
  };

  return project.calendar_event_id
    ? (supabase as any)
        .from("calendar_events")
        .update(payload)
        .eq("id", project.calendar_event_id)
        .eq("workspace_id", workspaceId)
        .select("id")
        .single()
    : (supabase as any)
        .from("calendar_events")
        .insert(payload)
        .select("id")
        .single();
};
