export type ReviewProject = {
  id: string;
  name: string;
  status?: string | null;
  next_action?: string | null;
  open_tasks?: number | null;
};

export type ReviewWaitingItem = {
  id: string;
  item: string;
  person?: string | null;
  follow_up_date?: string | null;
};

const CLOSED_PROJECT_STATUSES = new Set(["Completed", "Archived"]);

export const isStalledProject = (project: ReviewProject) => {
  if (CLOSED_PROJECT_STATUSES.has(project.status || "")) return false;
  if (!((project.open_tasks || 0) > 0)) return false;
  return !project.next_action || !project.next_action.trim();
};

export const isOverdueFollowUp = (item: ReviewWaitingItem, today: string) => {
  if (!item.follow_up_date) return false;
  return item.follow_up_date <= today;
};
