type StatusProject = {
  status?: string | null;
};

type StatusStats = {
  progress: number;
  openTasks: unknown[];
};

/** A project is done when its tasks are all done, or someone said so explicitly. */
export const isProjectComplete = (
  project: StatusProject,
  stats?: StatusStats
) => stats?.progress === 100 || Boolean(project.status?.toLowerCase().includes("complete"));

// "Needs action" is a subset of active: still open, but nothing left to do next.
// Both this and the active check route through isProjectComplete so the stat
// cards and the filter pills can never disagree about what counts as done.
export const needsAction = (project: StatusProject, stats?: StatusStats) =>
  Boolean(stats) && !isProjectComplete(project, stats) && stats!.openTasks.length === 0;
