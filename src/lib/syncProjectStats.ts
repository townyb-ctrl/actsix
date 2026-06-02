import { supabase } from "@/integrations/supabase/client";

export const syncProjectStats = async (
  projectName?: string | null,
  userId?: string | null
) => {
  const name = projectName?.trim();

  if (!name) return;

  const projectQuery = userId
    ? supabase
        .from("projects")
        .select("id")
        .eq("name", name)
        .eq("user_id", userId)
        .limit(1)
    : supabase.from("projects").select("id").eq("name", name).limit(1);

  const { data: projectData, error: projectError } = await projectQuery;

  if (projectError) throw projectError;

  const project = projectData?.[0];

  if (!project) return;

  await syncProjectStatsById(project.id);
};

export const syncProjectStatsById = async (projectId?: string | null) => {
  if (!projectId) return;

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .limit(1);

  if (projectError) throw projectError;

  const project = projectData?.[0];

  if (!project) return;

  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select("title, complete, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  if (taskError) throw taskError;

  const projectTasks = taskData ?? [];
  const openTasks = projectTasks.filter((task) => !task.complete);
  const completedTasks = projectTasks.filter((task) => task.complete);

  const progress =
    projectTasks.length === 0
      ? 0
      : Math.round((completedTasks.length / projectTasks.length) * 100);

  const nextAction = openTasks[0]?.title ?? "";

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      open_tasks: openTasks.length,
      progress,
      next_action: nextAction,
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id);

  if (updateError) throw updateError;
};

export const syncProjectStatsForNames = async (
  projectNames: Array<string | null | undefined>,
  userId?: string | null
) => {
  const uniqueNames = Array.from(
    new Set(projectNames.map((name) => name?.trim()).filter(Boolean))
  ) as string[];

  await Promise.all(uniqueNames.map((name) => syncProjectStats(name, userId)));
};

export const syncProjectStatsForIds = async (
  projectIds: Array<string | null | undefined>
) => {
  const uniqueIds = Array.from(
    new Set(projectIds.map((projectId) => projectId?.trim()).filter(Boolean))
  ) as string[];

  await Promise.all(uniqueIds.map((projectId) => syncProjectStatsById(projectId)));
};
