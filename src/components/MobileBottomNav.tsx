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
        "group flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[1.35rem] px-1 text-[10px] font-extrabold text-muted-foreground transition",
        "hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/25",
        active && "text-brand-teal"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-2xl transition",
          active
            ? "bg-brand-teal/10 shadow-[inset_0_0_0_1px_rgba(45,140,140,0.08)]"
            : "group-hover:bg-brand-teal/5"
        )}
      >
        <Icon className={cn("h-5 w-5 transition", active && "stroke-[2.45px]")} />
      </span>
      <span className="max-w-[58px] truncate leading-none">{item.label}</span>
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
        "group flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[1.35rem] px-1 text-[10px] font-extrabold text-muted-foreground transition",
        "hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/25",
        active && "text-brand-teal",
        emphasis && "bg-brand-teal text-white shadow-[0_9px_22px_rgba(45,140,140,0.22)] hover:bg-brand-teal-dark hover:text-white"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-2xl transition",
          emphasis
            ? "bg-white/15"
            : active
              ? "bg-brand-teal/10 shadow-[inset_0_0_0_1px_rgba(45,140,140,0.08)]"
              : "group-hover:bg-brand-teal/5"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="max-w-[58px] truncate leading-none">{label}</span>
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
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] md:hidden">
      <div className="relative mx-auto max-w-md">
        <div
          className={cn(
            "absolute left-1/2 bottom-[5.35rem] z-20 flex w-[92%] max-w-[350px] -translate-x-1/2 items-center justify-between gap-1 rounded-full border border-brand-teal/15 bg-brand-teal px-3 py-2 shadow-[0_14px_34px_rgba(45,140,140,0.24)] transition-all duration-200",
            switcherOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-3 scale-95 opacity-0"
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
                  "flex h-11 min-w-0 flex-1 items-center justify-center rounded-full text-white/85 transition active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                  active && "bg-white/15 text-white ring-1 ring-white/25"
                )}
                aria-label={`Open ${module.label}`}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>

        <div className="relative overflow-visible rounded-[1.9rem] border border-border/75 bg-white/95 px-2 pb-2 pt-3 shadow-[0_-10px_30px_rgba(30,30,27,0.11)] backdrop-blur-xl before:absolute before:left-1/2 before:top-0 before:h-16 before:w-24 before:-translate-x-1/2 before:-translate-y-[42%] before:rounded-full before:bg-white/95 before:shadow-[0_0_0_1px_rgba(227,222,211,0.72)] before:content-['']">
          <div className="relative z-10 grid grid-cols-[1fr_1fr_68px_1fr_1fr] items-end gap-1">
            <DockLink
              item={{ icon: Home, label: "Home", path: "/" }}
              active={location.pathname === "/"}
            />

            <DockLink
              item={currentConfig.primary}
              active={isActivePath(location.pathname, currentConfig.primary.path)}
            />

            <div className="relative flex h-[58px] items-end justify-center">
              <button
                type="button"
                onClick={() => setSwitcherOpen((open) => !open)}
                className="absolute left-1/2 top-[-3.55rem] flex h-[70px] w-[70px] -translate-x-1/2 items-center justify-center rounded-full border-[7px] border-white bg-white shadow-[0_10px_26px_rgba(30,30,27,0.13)] transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-teal/25"
                aria-label="Switch ACTSIX module"
                aria-expanded={switcherOpen}
              >
                <span className="flex h-[48px] w-[48px] items-center justify-center rounded-[1rem] bg-brand-teal/[0.07] ring-1 ring-brand-teal/10">
                  {switcherOpen ? (
                    <X className="h-6 w-6 text-brand-teal" />
                  ) : (
                    <img
                      src={actsixIcon}
                      alt="ACTSIX"
                      className="h-[40px] w-[40px] object-contain"
                    />
                  )}
                </span>
              </button>
            </div>

            <DockButton
              icon={currentConfig.menuIcon}
              label={currentConfig.menuLabel}
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

          <div className="grid grid-cols-1 gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-2">
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
                    "group flex min-h-[70px] items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-soft transition active:scale-[0.99]",
                    active
                      ? "border-brand-teal/35 bg-brand-teal/8"
                      : "border-border/70 hover:border-brand-teal/25 hover:bg-brand-teal/5"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                      active
                        ? "border-brand-teal/20 bg-brand-teal/10 text-brand-teal"
                        : "border-border/70 bg-background text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-foreground group-hover:text-brand-teal">
                      {item.label}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
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
              className="min-h-[120px] resize-none rounded-2xl border-border/80 bg-card text-base shadow-soft focus-visible:ring-brand-teal/25"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => saveQuickCapture(false)}
                disabled={captureSaving}
                className="min-h-[48px] rounded-2xl bg-brand-teal px-4 text-sm font-extrabold text-white shadow-soft transition hover:bg-brand-teal-dark disabled:opacity-60"
              >
                {captureSaving ? "Saving..." : "Save"}
              </button>

              <button
                type="button"
                onClick={() => saveQuickCapture(true)}
                disabled={captureSaving}
                className="min-h-[48px] rounded-2xl border border-brand-teal/20 bg-brand-teal/10 px-4 text-sm font-extrabold text-brand-teal transition hover:bg-brand-teal/15 disabled:opacity-60"
              >
                Save & open
              </button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-soft">
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
