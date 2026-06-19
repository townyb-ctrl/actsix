import type { DashboardWidgetDefinition } from "@/features/dashboard/types/dashboardTypes";
import { MyProjectsWidget } from "@/features/dashboard/components/widgets/MyProjectsWidget";
import { NotesWidget } from "@/features/dashboard/components/widgets/NotesWidget";
import { OverdueTasksWidget } from "@/features/dashboard/components/widgets/OverdueTasksWidget";
import { PeopleFollowupsWidget } from "@/features/dashboard/components/widgets/PeopleFollowupsWidget";
import { QuickActionsWidget } from "@/features/dashboard/components/widgets/QuickActionsWidget";
import { RecentActivityWidget } from "@/features/dashboard/components/widgets/RecentActivityWidget";
import { TodaysTasksWidget } from "@/features/dashboard/components/widgets/TodaysTasksWidget";
import { UpcomingMeetingsWidget } from "@/features/dashboard/components/widgets/UpcomingMeetingsWidget";
import { UpcomingServicesWidget } from "@/features/dashboard/components/widgets/UpcomingServicesWidget";
import { UpcomingTasksWidget } from "@/features/dashboard/components/widgets/UpcomingTasksWidget";

export const widgetDefinitions: DashboardWidgetDefinition[] = [
  {
    id: "todays-tasks",
    title: "Today's Tasks",
    subtitle: "Due today",
    category: "Tasks",
    description: "Tasks that need attention today, sorted by priority.",
    defaultSize: "large",
    component: TodaysTasksWidget,
  },
  {
    id: "overdue-tasks",
    title: "Overdue Tasks",
    subtitle: "Needs follow-through",
    category: "Tasks",
    description: "Open tasks with due dates before today.",
    defaultSize: "medium",
    component: OverdueTasksWidget,
  },
  {
    id: "upcoming-tasks",
    title: "Upcoming Tasks",
    subtitle: "Next two weeks",
    category: "Tasks",
    description: "Open tasks coming up soon so nothing slips quietly.",
    defaultSize: "medium",
    component: UpcomingTasksWidget,
  },
  {
    id: "upcoming-services",
    title: "Upcoming Services",
    subtitle: "Next service plan",
    category: "Services",
    description: "The next service date with a quick look at order items.",
    defaultSize: "medium",
    component: UpcomingServicesWidget,
  },
  {
    id: "my-projects",
    title: "My Projects",
    subtitle: "Active momentum",
    category: "Projects",
    description: "Active ministry projects with next actions and task progress.",
    defaultSize: "large",
    component: MyProjectsWidget,
  },
  {
    id: "upcoming-meetings",
    title: "Upcoming Meetings",
    subtitle: "Next 6 days",
    category: "Meetings",
    description: "Meetings coming up this week.",
    defaultSize: "medium",
    component: UpcomingMeetingsWidget,
  },
  {
    id: "people-followups",
    title: "People Follow-ups",
    subtitle: "Care and connection",
    category: "People",
    description: "Follow-up flavored tasks such as calls, check-ins, and care touches.",
    defaultSize: "medium",
    component: PeopleFollowupsWidget,
  },
  {
    id: "quick-actions",
    title: "Quick Actions",
    subtitle: "Common starts",
    category: "Personal",
    description: "A compact launchpad for everyday ministry work.",
    defaultSize: "small",
    component: QuickActionsWidget,
  },
  {
    id: "recent-activity",
    title: "Recent Activity",
    subtitle: "Latest ministry signals",
    category: "Personal",
    description: "A lightweight feed from current dashboard data.",
    defaultSize: "medium",
    component: RecentActivityWidget,
  },
  {
    id: "notes",
    title: "Notes / Scratchpad",
    subtitle: "Private dashboard note",
    category: "Personal",
    description: "A simple auto-saved note for the day.",
    defaultSize: "medium",
    component: NotesWidget,
  },
];
