import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Maximize2,
  MoreHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { UserDashboardWidget, WidgetSize } from "@/features/dashboard/types/dashboardTypes";

const sizeLabels: Record<WidgetSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  full: "Full",
};

type DashboardWidgetCardProps = {
  widget: UserDashboardWidget;
  title: string;
  subtitle?: string;
  children: ReactNode;
  customizeMode: boolean;
  index: number;
  totalWidgets: number;
  onMove: (direction: "up" | "down") => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
  onConfigure: () => void;
  dragHandleAttributes?: Record<string, unknown>;
  dragHandleListeners?: Record<string, unknown>;
};

export function DashboardWidgetCard({
  widget,
  title,
  subtitle,
  children,
  customizeMode,
  index,
  totalWidgets,
  onMove,
  onResize,
  onRemove,
  onConfigure,
  dragHandleAttributes,
  dragHandleListeners,
}: DashboardWidgetCardProps) {
  return (
    <Card
      className={cn(
        "group flex min-h-[220px] min-w-0 flex-col overflow-hidden rounded-[1.2rem] border border-border/60 bg-card/82 shadow-[0_1px_0_rgba(207,198,181,0.4)] transition duration-200 hover:border-brand-teal/22 hover:bg-card md:h-full md:min-h-0",
        customizeMode && "border-brand-teal/28 bg-brand-teal/5 ring-1 ring-brand-teal/15"
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/45 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-2">
          {customizeMode && (
            <button
              type="button"
              className="-ml-1 mt-0.5 inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md bg-background/70 text-muted-foreground transition hover:bg-brand-teal/10 hover:text-brand-teal active:cursor-grabbing"
              title="Click and hold to drag"
              aria-label={`Drag ${widget.settings?.title || title} to reorder`}
              style={{ touchAction: "none" }}
              {...dragHandleAttributes}
              {...dragHandleListeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold tracking-tight text-foreground">
            {widget.settings?.title || title}
          </h2>
          {(widget.settings?.subtitle || subtitle) && (
            <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-muted-foreground">
              {widget.settings?.subtitle || subtitle}
            </p>
          )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0 text-muted-foreground transition",
                !customizeMode && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Widget actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Widget</DropdownMenuLabel>
            <DropdownMenuItem onClick={onConfigure}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Size</DropdownMenuLabel>
            {(["small", "medium", "large", "full"] as WidgetSize[]).map((size) => (
              <DropdownMenuItem key={size} onClick={() => onResize(size)}>
                <Maximize2 className="mr-2 h-4 w-4" />
                {sizeLabels[size]}
              </DropdownMenuItem>
            ))}
            {customizeMode && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={index === 0} onClick={() => onMove("up")}>
                  <ArrowUp className="mr-2 h-4 w-4" />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem disabled={index === totalWidgets - 1} onClick={() => onMove("down")}>
                  <ArrowDown className="mr-2 h-4 w-4" />
                  Move down
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-brand-danger" onClick={onRemove}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {customizeMode && (
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-teal/15 bg-background/60 px-4 py-2 sm:px-5">
          <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            {sizeLabels[widget.size]}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="actsix-btn-outline h-7 px-2 text-[11px]"
            disabled={index === 0}
            onClick={() => onMove("up")}
          >
            <ArrowUp className="h-3 w-3" />
            Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="actsix-btn-outline h-7 px-2 text-[11px]"
            disabled={index === totalWidgets - 1}
            onClick={() => onMove("down")}
          >
            <ArrowDown className="h-3 w-3" />
            Down
          </Button>
          <span className="ml-auto hidden text-[11px] font-bold text-muted-foreground sm:inline">
            Drag handle or use menu
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">{children}</div>
    </Card>
  );
}
