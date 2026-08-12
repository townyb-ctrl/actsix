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
  // People follow-ups was previously visible only in the hardcoded home panels,
  // which the saved layout never rendered. Now that the layout is the single
  // rendering path, it has to be in the default or it disappears for everyone.
  {
    id: "people-followups-default",
    definitionId: "people-followups",
    size: "medium",
  },
]);
