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

  const taskQuery = userId
    ? supabase
        .from("tasks")
        .select("title, complete, created_at")
        .eq("project", name)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    : supabase
        .from("tasks")
        .select("title, complete, created_at")
        .eq("project", name)
        .order("created_at", { ascending: false });

  const { data: taskData, error: taskError } = await taskQuery;

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
