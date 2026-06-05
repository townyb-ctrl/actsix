import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Home,
  Inbox,
  LayoutGrid,
  ListChecks,
  Menu,
  Music,
  Plus,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import actsixIcon from "@/assets/branding/actsix-icon-black.png";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";

type MobileModuleKey =
  | "home"
  | "tasks"
  | "projects"
  | "servicePlanner"
  | "meetings"
  | "people"
  | "settings";

type MobileDockLink = {
  icon: LucideIcon;
  label: string;
  path: string;
};

type MobileMenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  description: string;
};

type MobileModuleConfig = {
  key: MobileModuleKey;
  title: string;
  subtitle: string;
  primary: MobileDockLink;
  menuLabel: string;
  menuIcon: LucideIcon;
  menuItems: MobileMenuItem[];
};

const isActivePath = (pathname: string, path: string) => {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
};

const detectModule = (pathname: string): MobileModuleKey => {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/service-planner")) return "servicePlanner";
  if (pathname.startsWith("/meetings")) return "meetings";
  if (pathname.startsWith("/people")) return "people";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/tasks/projects") || pathname.startsWith("/projects")) {
    return "projects";
  }
  if (
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/inbox") ||
    pathname.startsWith("/waiting") ||
    pathname.startsWith("/someday") ||
    pathname.startsWith("/recurring") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/meetups")
  ) {
    return "tasks";
  }

  return "home";
};

const moduleConfigs: Record<MobileModuleKey, MobileModuleConfig> = {
  home: {
    key: "home",
    title: "Home",
    subtitle: "Your ministry command centre.",
    primary: { icon: Inbox, label: "Inbox", path: "/tasks/inbox" },
    menuLabel: "Agenda",
    menuIcon: Calendar,
    menuItems: [
      {
        icon: LayoutGrid,
        label: "Dashboard",
        path: "/",
        description: "Today, services, meetings, and projects.",
      },
      {
        icon: Inbox,
        label: "Inbox",
        path: "/tasks/inbox",
        description: "Capture and process ministry thoughts.",
      },
      {
        icon: ListChecks,
        label: "Next Actions",
        path: "/tasks/next",
        description: "Tasks that need attention.",
      },
      {
        icon: Music,
        label: "Services",
        path: "/service-planner/services",
        description: "Upcoming service planning.",
      },
      {
        icon: Calendar,
        label: "Meetings",
        path: "/meetings",
        description: "Agendas, minutes, and decisions.",
      },
    ],
  },
  tasks: {
    key: "tasks",
    title: "Tasks",
    subtitle: "Inbox, next actions, waiting, and someday.",
    primary: { icon: ListChecks, label: "Today", path: "/tasks/next" },
    menuLabel: "Tasks",
    menuIcon: Menu,
    menuItems: [
      {
        icon: ListChecks,
        label: "Next Actions",
        path: "/tasks/next",
        description: "Your main task list.",
      },
      {
        icon: Inbox,
        label: "Inbox",
        path: "/tasks/inbox",
        description: "Unprocessed captures.",
      },
      {
        icon: FolderKanban,
        label: "Projects",
        path: "/tasks/projects",
        description: "Ministry work in motion.",
      },
      {
        icon: CheckSquare,
        label: "Waiting For",
        path: "/tasks/waiting",
        description: "Things delegated or pending.",
      },
      {
        icon: BookOpen,
        label: "Someday",
        path: "/tasks/someday",
        description: "Ideas and future possibilities.",
      },
      {
        icon: Calendar,
        label: "Calendar",
        path: "/tasks/calendar",
        description: "Task dates and upcoming work.",
      },
    ],
  },
  projects: {
    key: "projects",
    title: "Projects",
    subtitle: "Track ministry initiatives and next steps.",
    primary: { icon: FolderKanban, label: "Projects", path: "/tasks/projects" },
    menuLabel: "Projects",
    menuIcon: Menu,
    menuItems: [
      {
        icon: FolderKanban,
        label: "Projects",
        path: "/tasks/projects",
        description: "All active projects.",
      },
      {
        icon: ListChecks,
        label: "Next Actions",
        path: "/tasks/next",
        description: "Tasks connected to projects.",
      },
      {
        icon: Inbox,
        label: "Inbox",
        path: "/tasks/inbox",
        description: "Capture project ideas.",
      },
    ],
  },
  servicePlanner: {
    key: "servicePlanner",
    title: "Service Planning",
    subtitle: "Services, teams, and repertoire.",
    primary: { icon: Music, label: "Services", path: "/service-planner/services" },
    menuLabel: "Service",
    menuIcon: Menu,
    menuItems: [
      {
        icon: Music,
        label: "Services",
        path: "/service-planner/services",
        description: "Service types and dates.",
      },
      {
        icon: Users,
        label: "Teams",
        path: "/service-planner/teams",
        description: "Serving teams and roles.",
      },
      {
        icon: BookOpen,
        label: "Repertoire",
        path: "/service-planner/repertoire",
        description: "Songs and worship resources.",
      },
    ],
  },
  meetings: {
    key: "meetings",
    title: "Meetings",
    subtitle: "Agendas, minutes, and action points.",
    primary: { icon: Calendar, label: "Meetings", path: "/meetings" },
    menuLabel: "Meetings",
    menuIcon: Menu,
    menuItems: [
      {
        icon: Calendar,
        label: "All Meetings",
        path: "/meetings",
        description: "Upcoming and recent meetings.",
      },
      {
        icon: ClipboardList,
        label: "Recurring",
        path: "/meetings/recurring",
        description: "Repeat meeting rhythms.",
      },
      {
        icon: ListChecks,
        label: "Actions",
        path: "/tasks/next",
        description: "Follow-up action points.",
      },
      {
        icon: Inbox,
        label: "Capture",
        path: "/tasks/inbox",
        description: "Process meeting notes later.",
      },
    ],
  },
  people: {
    key: "people",
    title: "People",
    subtitle: "People, groups, and ministry involvement.",
    primary: { icon: Users, label: "People", path: "/people" },
    menuLabel: "People",
    menuIcon: Menu,
    menuItems: [
      {
        icon: Users,
        label: "Directory",
        path: "/people",
        description: "People profiles and contact details.",
      },
      {
        icon: FolderKanban,
        label: "Groups",
        path: "/people/groups",
        description: "People folders and ministry groups.",
      },
      {
        icon: Inbox,
        label: "Capture note",
        path: "/tasks/inbox",
        description: "Capture a follow-up or care note.",
      },
    ],
  },
  settings: {
    key: "settings",
    title: "Settings",
    subtitle: "Workspace and account settings.",
    primary: { icon: Settings, label: "Settings", path: "/settings" },
    menuLabel: "Settings",
    menuIcon: Menu,
    menuItems: [
      {
        icon: Settings,
        label: "Settings",
        path: "/settings",
        description: "General settings.",
      },
      {
        icon: Users,
        label: "Workspace",
        path: "/settings/workspace",
        description: "Workspace members and access.",
      },
    ],
  },
};

const moduleSwitcherItems: Array<{
  key: MobileModuleKey;
  icon: LucideIcon;
  label: string;
  path: string;
}> = [
  { key: "tasks", icon: ListChecks, label: "Tasks", path: "/tasks/next" },
  { key: "servicePlanner", icon: Music, label: "Services", path: "/service-planner/services" },
  { key: "meetings", icon: Calendar, label: "Meetings", path: "/meetings" },
  { key: "people", icon: Users, label: "People", path: "/people" },
  { key: "projects", icon: FolderKanban, label: "Projects", path: "/tasks/projects" },
];

const DockLink = ({ item, active }: { item: MobileDockLink; active: boolean }) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      aria-current={active ? "page" : undefined}
      className={cn(
        "actsix-mobile-dock-item group flex min-h-[58px] flex-col items-center justify-center gap-1",
        active && "text-brand-teal"
      )}
    >
      <span
        className={cn(
          "actsix-mobile-dock-icon",
          active
            ? "bg-brand-teal/10 shadow-[inset_0_0_0_1px_rgba(45,140,140,0.08)]"
            : "group-hover:bg-brand-teal/5"
        )}
      >
        <Icon className={cn("h-5 w-5 transition", active && "stroke-[2.45px]")} />
      </span>
      <span className="max-w-[62px] truncate leading-none">{item.label}</span>
    </Link>
  );
};

const DockButton = ({
  icon: Icon,
  label,
  onClick,
  active,
  emphasis,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  emphasis?: boolean;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "actsix-mobile-dock-item group flex min-h-[58px] flex-col items-center justify-center gap-1",
        active && "text-brand-teal",
        emphasis && "text-brand-teal hover:text-brand-teal"
      )}
    >
      <span
        className={cn(
          "actsix-mobile-dock-icon",
          emphasis
            ? "bg-brand-teal text-white shadow-[0_8px_18px_rgba(45,140,140,0.2)] group-hover:bg-brand-teal-dark"
            : active
              ? "bg-brand-teal/10 shadow-[inset_0_0_0_1px_rgba(45,140,140,0.08)]"
              : "group-hover:bg-brand-teal/5"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="max-w-[62px] truncate leading-none">{label}</span>
    </button>
  );
};

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [captureSaving, setCaptureSaving] = useState(false);

  const currentModuleKey = useMemo(
    () => detectModule(location.pathname),
    [location.pathname]
  );

  const currentConfig = moduleConfigs[currentModuleKey];
  const activeMenuItem = currentConfig.menuItems.find((item) =>
    isActivePath(location.pathname, item.path)
  );

  const saveQuickCapture = async (openInboxAfterSave = false) => {
    const title = captureText.trim();

    if (!title) {
      toast.error("Write something to capture first.");
      return;
    }

    if (!user) {
      toast.error("You need to be signed in to capture an item.");
      return;
    }

    setCaptureSaving(true);

    const { error } = await supabase.from("inbox_items").insert({
      id: crypto.randomUUID(),
      title,
      user_id: user.id,
      notes: `Captured from ${currentConfig.title} on mobile.`,
    });

    setCaptureSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setCaptureText("");
    setCaptureOpen(false);
    toast.success("Captured to inbox");

    if (openInboxAfterSave) {
      navigate("/tasks/inbox");
    }
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] md:hidden">
      <div className="relative mx-auto max-w-md">
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-brand-teal shadow-[0_10px_24px_rgba(45,140,140,0.24)] transition-all duration-200 ease-out",
            switcherOpen
              ? "bottom-[5.1rem] scale-x-[2.6] scale-y-75 opacity-80"
              : "bottom-[3.55rem] scale-75 opacity-0"
          )}
        />

        <div
          className={cn(
            "absolute left-1/2 bottom-[5.5rem] z-20 flex h-12 origin-bottom -translate-x-1/2 items-center justify-between gap-1 overflow-hidden rounded-full border border-white/10 bg-brand-teal shadow-[0_16px_34px_rgba(45,140,140,0.26)] transition-all duration-200 ease-out",
            switcherOpen
              ? "pointer-events-auto w-[min(90%,21rem)] translate-y-0 scale-x-100 px-3 opacity-100"
              : "pointer-events-none w-12 translate-y-7 scale-x-[0.18] px-0 opacity-0"
          )}
        >
          {moduleSwitcherItems.map((module) => {
            const Icon = module.icon;
            const active = currentModuleKey === module.key;

            return (
              <button
                key={module.key}
                type="button"
                onClick={() => {
                  setSwitcherOpen(false);
                  navigate(module.path);
                }}
                className={cn(
                  "flex h-10 min-w-0 flex-1 items-center justify-center rounded-full text-white/85 transition-all duration-200 ease-out active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                  switcherOpen
                    ? "translate-y-0 opacity-100 delay-75"
                    : "translate-y-1 opacity-0 delay-0",
                  active && "bg-white/15 text-white ring-1 ring-white/25"
                )}
                aria-label={`Open ${module.label}`}
                tabIndex={switcherOpen ? 0 : -1}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>

        <div className="relative overflow-visible rounded-[var(--radius-panel)] border border-border/75 bg-white/95 px-2 pb-2 pt-2.5 shadow-[0_-8px_26px_rgba(30,30,27,0.1)] backdrop-blur-xl before:absolute before:left-1/2 before:top-0 before:h-14 before:w-20 before:-translate-x-1/2 before:-translate-y-[40%] before:rounded-full before:bg-white/95 before:shadow-[0_0_0_1px_rgba(227,222,211,0.72)] before:content-['']">
          <div className="relative z-10 grid grid-cols-[1fr_1fr_62px_1fr_1fr] items-end gap-1.5">
            <DockLink
              item={{ icon: Home, label: "Home", path: "/" }}
              active={location.pathname === "/"}
            />

            <div className="min-w-0">
              <NotificationBell collapsed tone="dock" />
            </div>

            <div className="relative flex h-[54px] items-end justify-center">
              <span
                className={cn(
                  "pointer-events-none absolute left-1/2 top-[-0.5rem] h-6 w-8 -translate-x-1/2 rounded-b-full bg-white/95 shadow-[0_8px_14px_rgba(30,30,27,0.05)] transition-all duration-200 ease-out",
                  switcherOpen && "h-7 w-9"
                )}
              />
              <button
                type="button"
                onClick={() => setSwitcherOpen((open) => !open)}
                className={cn(
                  "absolute left-1/2 top-[-3.15rem] flex h-[64px] w-[64px] -translate-x-1/2 items-center justify-center rounded-full border-[6px] border-white bg-white shadow-[0_10px_24px_rgba(30,30,27,0.13)] transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-teal/25",
                  switcherOpen && "shadow-[0_15px_30px_rgba(45,140,140,0.24)]"
                )}
                aria-label="Switch ACTSIX module"
                aria-expanded={switcherOpen}
              >
                <span
                  className={cn(
                    "relative flex h-[44px] w-[44px] items-center justify-center overflow-hidden rounded-[var(--radius-control)] ring-1 transition-all duration-200 ease-out",
                    switcherOpen
                      ? "bg-brand-teal text-white ring-brand-teal"
                      : "bg-brand-teal/[0.07] ring-brand-teal/10"
                  )}
                >
                  <img
                    src={actsixIcon}
                    alt="ACTSIX"
                    className={cn(
                      "absolute h-9 w-9 object-contain transition-all duration-200 ease-out",
                      switcherOpen
                        ? "scale-75 rotate-45 opacity-0"
                        : "scale-100 rotate-0 opacity-100 delay-75"
                    )}
                  />
                  <X
                    className={cn(
                      "absolute h-6 w-6 text-white transition-all duration-200 ease-out",
                      switcherOpen
                        ? "scale-100 rotate-0 opacity-100 delay-75"
                        : "scale-75 -rotate-45 opacity-0"
                    )}
                  />
                </span>
              </button>
            </div>

            <DockButton
              icon={currentConfig.menuIcon}
              label="Menu"
              active={Boolean(activeMenuItem)}
              onClick={() => {
                setSwitcherOpen(false);
                setMenuOpen(true);
              }}
            />

            <DockButton
              icon={Plus}
              label="Capture"
              onClick={() => {
                setSwitcherOpen(false);
                setCaptureOpen(true);
              }}
              emphasis
            />
          </div>
        </div>
      </div>

      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent className="border-border/70 bg-background">
          <DrawerHeader className="px-5 pb-2 text-left">
            <p className="label-eyebrow">{currentConfig.title}</p>
            <DrawerTitle className="text-2xl font-extrabold tracking-tight">
              Module menu
            </DrawerTitle>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {currentConfig.subtitle}
            </p>
          </DrawerHeader>

          <div className="grid grid-cols-1 gap-2.5 px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-2">
            {currentConfig.menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(location.pathname, item.path);

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(item.path);
                  }}
                  className={cn(
                    "actsix-interactive-tile group flex min-h-[68px] items-center gap-3.5 p-3.5 text-left",
                    active
                      ? "border-brand-teal/35 bg-brand-teal/10"
                      : "border-border/70 hover:border-brand-teal/25 hover:bg-brand-teal/5"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center border",
                      active
                        ? "border-brand-teal/20 bg-brand-teal/10 text-brand-teal"
                        : "border-border/70 bg-background text-muted-foreground"
                    )}
                    style={{ borderRadius: "var(--radius-panel)" }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-extrabold text-foreground group-hover:text-brand-teal">
                      {item.label}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={captureOpen} onOpenChange={setCaptureOpen}>
        <DrawerContent className="border-border/70 bg-background">
          <DrawerHeader className="px-5 pb-2 text-left">
            <p className="label-eyebrow">Quick Capture</p>
            <DrawerTitle className="text-2xl font-extrabold tracking-tight">
              What needs attention?
            </DrawerTitle>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Capture it now. Process it properly from the inbox later.
            </p>
          </DrawerHeader>

          <div className="space-y-4 px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-2">
            <Textarea
              value={captureText}
              onChange={(event) => setCaptureText(event.target.value)}
              placeholder="Type a task, reminder, idea, follow-up, meeting note..."
              className="min-h-[132px] resize-none border-border/80 bg-card px-4 py-3 text-base shadow-soft focus-visible:ring-brand-teal/25"
              style={{ borderRadius: "var(--radius-panel)" }}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => saveQuickCapture(false)}
                disabled={captureSaving}
                className="actsix-btn-primary min-h-[48px] px-4 text-sm font-extrabold disabled:opacity-60"
              >
                {captureSaving ? "Saving..." : "Save"}
              </button>

              <button
                type="button"
                onClick={() => saveQuickCapture(true)}
                disabled={captureSaving}
                className="actsix-btn-outline min-h-[48px] border-brand-teal/20 px-4 text-sm font-extrabold text-brand-teal disabled:opacity-60"
              >
                Save & open
              </button>
            </div>

            <div className="actsix-panel-soft p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                Capture examples
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "Follow up with a volunteer",
                  "Add song idea",
                  "Prepare agenda item",
                  "Call someone back",
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setCaptureText(example)}
                    className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:border-brand-teal/25 hover:text-brand-teal"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </nav>
  );
}
