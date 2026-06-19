import { Link } from "react-router-dom";
import { CalendarPlus, ClipboardList, FolderPlus, Inbox, UsersRound } from "lucide-react";
import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";

const actions = [
  { label: "Capture task", to: "/tasks/next", icon: ClipboardList },
  { label: "Open inbox", to: "/inbox", icon: Inbox },
  { label: "Plan service", to: "/service-planner", icon: CalendarPlus },
  { label: "Review people", to: "/people", icon: UsersRound },
  { label: "Projects", to: "/tasks/projects", icon: FolderPlus },
];

export function QuickActionsWidget(_: DashboardWidgetRenderProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <Link
            key={action.to}
            to={action.to}
            className="group flex min-h-[42px] items-center gap-2 rounded-lg border border-border/80 bg-background/70 px-3 py-2 text-sm font-extrabold transition hover:border-brand-teal/35 hover:bg-brand-teal/5 hover:text-brand-teal"
          >
            <Icon className="h-4 w-4 text-brand-teal" />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
