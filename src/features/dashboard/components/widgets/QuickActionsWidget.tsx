import { Link } from "react-router-dom";
import { CalendarPlus, ClipboardList, FolderPlus, Inbox, UsersRound } from "lucide-react";
import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";

const actions = [
  { label: "Capture task", to: "/tasks/next", icon: ClipboardList },
  { label: "Open inbox", to: "/tasks/inbox", icon: Inbox },
  { label: "Plan service", to: "/service-planner", icon: CalendarPlus },
  { label: "Review people", to: "/people", icon: UsersRound },
  { label: "Projects", to: "/tasks/projects", icon: FolderPlus },
];

export function QuickActionsWidget(_: DashboardWidgetRenderProps) {
  return (
    <div className="st-actions">
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <Link key={action.to} to={action.to} className="st-action">
            <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--st-accent)" }} />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
