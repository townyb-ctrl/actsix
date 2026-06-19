import type { ComponentType } from "react";

export type WidgetSize = "small" | "medium" | "large" | "full";

export type WidgetCategory =
  | "Tasks"
  | "Services"
  | "People"
  | "Meetings"
  | "Projects"
  | "Events"
  | "Finance"
  | "Files"
  | "Personal";

export type DashboardWidgetSettings = {
  title?: string;
  subtitle?: string;
  itemLimit?: number;
  notes?: string;
};

export type UserDashboardWidget = {
  id: string;
  definitionId: string;
  size: WidgetSize;
  settings?: DashboardWidgetSettings;
};

export type UserDashboardLayout = {
  version: number;
  widgets: UserDashboardWidget[];
  updatedAt: string;
};

export type DashboardTask = {
  id: string;
  title: string;
  due?: string | null;
  priority?: string | null;
  project?: string | null;
  project_id?: string | null;
  context?: string | null;
  minutes?: number | null;
  complete?: boolean | null;
  created_at?: string | null;
  project_sections?: { name?: string | null } | { name?: string | null }[] | null;
};

export type DashboardProject = {
  id: string;
  name: string;
  area?: string | null;
  status?: string | null;
  next_action?: string | null;
  open_tasks?: number | null;
  progress?: number | null;
  updated_at?: string | null;
};

export type DashboardMeeting = {
  id: string;
  title: string;
  meeting_date?: string | null;
  meeting_time?: string | null;
  location?: string | null;
  status?: string | null;
  type?: string | null;
};

export type DashboardServiceInstance = {
  id: string;
  title?: string | null;
  service_date: string;
  start_time?: string | null;
  location?: string | null;
  service_type_id: string;
  service_types?: { name?: string | null } | null;
};

export type DashboardServiceOrderItem = {
  id: string;
  title: string;
  item_type: string;
  duration_minutes?: number | null;
  sort_order: number;
};

export type DashboardServiceTeamAssignment = {
  id: string;
  person_name: string;
  role_name: string;
  sort_order: number;
};

export type DashboardWidgetData = {
  tasks: DashboardTask[];
  projectTasks: DashboardTask[];
  projects: DashboardProject[];
  meetings: DashboardMeeting[];
  nextService: DashboardServiceInstance | null;
  serviceOrderItems: DashboardServiceOrderItem[];
  serviceTeamAssignments: DashboardServiceTeamAssignment[];
  now: Date;
  todayKey: string;
};

export type DashboardWidgetRenderProps = {
  widget: UserDashboardWidget;
  data: DashboardWidgetData;
  updateSettings: (settings: DashboardWidgetSettings) => void;
};

export type DashboardWidgetDefinition = {
  id: string;
  title: string;
  subtitle?: string;
  category: WidgetCategory;
  description: string;
  defaultSize: WidgetSize;
  component: ComponentType<DashboardWidgetRenderProps>;
};
