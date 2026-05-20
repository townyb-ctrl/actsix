export type ActsixReleaseMode = "alpha" | "beta" | "full";

export type ActsixModuleKey =
  | "home"
  | "tasks"
  | "meetings"
  | "service_planner"
  | "people"
  | "sermon_hub"
  | "resources"
  | "chat"
  | "reports"
  | "media";

const releaseMode = (import.meta.env.VITE_ACTSIX_RELEASE_MODE || "alpha") as ActsixReleaseMode;

const alphaModules: Record<ActsixModuleKey, boolean> = {
  home: true,
  tasks: true,
  meetings: true,
  service_planner: true,
  people: true,
  sermon_hub: false,
  resources: false,
  chat: false,
  reports: false,
  media: false,
};

const betaModules: Record<ActsixModuleKey, boolean> = {
  ...alphaModules,
};

const fullModules: Record<ActsixModuleKey, boolean> = {
  home: true,
  tasks: true,
  meetings: true,
  service_planner: true,
  people: true,
  sermon_hub: true,
  resources: true,
  chat: true,
  reports: true,
  media: true,
};

const moduleMap: Record<ActsixReleaseMode, Record<ActsixModuleKey, boolean>> = {
  alpha: alphaModules,
  beta: betaModules,
  full: fullModules,
};

export const ACTSIX_RELEASE_MODE = releaseMode;

export const isAlphaMode = ACTSIX_RELEASE_MODE === "alpha";

export const isModuleEnabled = (moduleKey: ActsixModuleKey) => {
  return moduleMap[ACTSIX_RELEASE_MODE]?.[moduleKey] ?? false;
};

export const getReleaseLabel = () => {
  if (ACTSIX_RELEASE_MODE === "alpha") return "Alpha";
  if (ACTSIX_RELEASE_MODE === "beta") return "Beta";
  return "Full";
};
