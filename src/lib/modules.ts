import type { ActsixModuleKey } from "@/lib/releaseMode";

export type ActiveModuleKey = Extract<
  ActsixModuleKey,
  "home" | "tasks" | "people" | "meetings" | "service_planner"
>;

export const REQUIRED_MODULES: ActiveModuleKey[] = ["home", "tasks", "people"];
export const OPTIONAL_MODULES: ActiveModuleKey[] = ["meetings", "service_planner"];

export const DEFAULT_ACTIVE_MODULES: Record<ActiveModuleKey, boolean> = {
  home: true,
  tasks: true,
  people: true,
  meetings: false,
  service_planner: false,
};

export const MODULE_LABELS: Record<ActiveModuleKey, string> = {
  home: "Home",
  tasks: "Tasks",
  people: "People",
  meetings: "Meetings",
  service_planner: "Service Planner",
};

export const MODULE_DESCRIPTIONS: Record<ActiveModuleKey, string> = {
  home: "Daily dashboard and cross-module overview.",
  tasks: "Next actions, inbox, projects, waiting, and someday.",
  people: "Directory, profiles, groups, and relationships.",
  meetings: "Agendas, minutes, recurring meetings, and action points.",
  service_planner: "Service dates, teams, order of service, and repertoire.",
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
  if (pathname === "/meetings" || pathname.startsWith("/meetings/")) return "meetings";
  if (pathname === "/service-planner" || pathname.startsWith("/service-planner/")) {
    return "service_planner";
  }

  return "home";
};
