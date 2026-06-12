import type { ActsixModuleKey } from "@/lib/releaseMode";

export type ActiveModuleKey = Extract<
  ActsixModuleKey,
  "home" | "tasks" | "people" | "groups" | "meetings" | "service_planner" | "sermon_hub" | "events" | "calendar"
>;

export const REQUIRED_MODULES: ActiveModuleKey[] = ["home", "tasks", "people"];
export const OPTIONAL_MODULES: ActiveModuleKey[] = ["groups", "meetings", "service_planner", "events", "calendar", "sermon_hub"];

export const DEFAULT_ACTIVE_MODULES: Record<ActiveModuleKey, boolean> = {
  home: true,
  tasks: true,
  people: true,
  groups: true,
  meetings: false,
  service_planner: false,
  events: true,
  calendar: true,
  sermon_hub: true,
};

export const MODULE_LABELS: Record<ActiveModuleKey, string> = {
  home: "Home",
  tasks: "Tasks",
  people: "People",
  groups: "Groups",
  meetings: "Meetings",
  service_planner: "Service Planner",
  events: "Events",
  calendar: "Calendar",
  sermon_hub: "Sermon / Lesson Hub",
};

export const MODULE_DESCRIPTIONS: Record<ActiveModuleKey, string> = {
  home: "Daily dashboard and cross-module overview.",
  tasks: "Next actions, inbox, projects, waiting, and someday.",
  people: "Directory, profiles, care notes, and relationships.",
  groups: "People folders, ministry groups, and team lists.",
  meetings: "Agendas, minutes, recurring meetings, and action points.",
  service_planner: "Service dates, teams, order of service, and repertoire.",
  events: "Church camps, mission trips, retreats, outreaches, and event logistics.",
  calendar: "Unified ministry calendar with Google, Outlook, and Apple sync setup.",
  sermon_hub: "Sermon planning, lesson outlines, teaching series, and reusable notes.",
};

export const isRequiredModule = (moduleKey: ActiveModuleKey) =>
  REQUIRED_MODULES.includes(moduleKey);

export const normalizeActiveModules = (
  modules?: Partial<Record<ActiveModuleKey, boolean>> | null
) => ({
  ...DEFAULT_ACTIVE_MODULES,
  ...(modules || {}),
  home: true,
  tasks: true,
  people: true,
});

export const getModuleKeyForPath = (pathname: string): ActiveModuleKey => {
  if (
    pathname === "/tasks" ||
    pathname.startsWith("/tasks/") ||
    ["/projects", "/inbox", "/waiting", "/someday"].includes(pathname)
  ) {
    return "tasks";
  }

  if (pathname === "/people" || pathname.startsWith("/people/")) return "people";
  if (pathname === "/groups" || pathname.startsWith("/groups/")) return "groups";
  if (pathname === "/sermon-hub" || pathname.startsWith("/sermon-hub/")) return "sermon_hub";
  if (pathname === "/events" || pathname.startsWith("/events/")) return "events";
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) return "calendar";
  if (pathname === "/meetings" || pathname.startsWith("/meetings/")) return "meetings";
  if (pathname === "/service-planner" || pathname.startsWith("/service-planner/")) {
    return "service_planner";
  }

  return "home";
};
