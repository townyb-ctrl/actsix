import type { UserDashboardLayout } from "@/features/dashboard/types/dashboardTypes";
import { createDashboardLayout } from "@/features/dashboard/utils/dashboardLayoutUtils";

export const defaultDashboardLayout: UserDashboardLayout = createDashboardLayout([
  {
    id: "todays-tasks-default",
    definitionId: "todays-tasks",
    size: "large",
    settings: { itemLimit: 5 },
  },
  {
    id: "upcoming-services-default",
    definitionId: "upcoming-services",
    size: "medium",
    settings: { itemLimit: 4 },
  },
  {
    id: "my-projects-default",
    definitionId: "my-projects",
    size: "large",
    settings: { itemLimit: 4 },
  },
  {
    id: "upcoming-meetings-default",
    definitionId: "upcoming-meetings",
    size: "medium",
    settings: { itemLimit: 5 },
  },
  {
    id: "quick-actions-default",
    definitionId: "quick-actions",
    size: "small",
  },
  {
    id: "recent-activity-default",
    definitionId: "recent-activity",
    size: "medium",
  },
]);
