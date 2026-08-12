import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
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
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: SyntheticListenerMap;
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
  // A widget body is a fixed grid cell, so a list taller than the cell gets sliced
  // mid-row at the bottom border and reads as a rendering fault rather than as
  // "there is more below". The flag drives a fade over the last few pixels, and it
  // is only on while there is genuinely more to scroll to — a permanent fade would
  // veil the final row of every widget that fits.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  const syncMoreBelow = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    syncMoreBelow();
    const observer = new ResizeObserver(syncMoreBelow);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);

    return () => observer.disconnect();
  }, [syncMoreBelow, children]);

  return (
    <Card
      className={cn(
        "st-panel group flex min-h-[220px] min-w-0 flex-col md:h-full md:min-h-0",
        customizeMode && "ring-1"
      )}
      style={
        customizeMode
          ? {
              borderColor: "var(--st-accent-edge)",
              boxShadow: "0 0 0 1px var(--st-accent-edge)",
            }
          : undefined
      }
    >
      <div className="st-panel-head">
        <div className="flex min-w-0 items-center gap-2">
          {customizeMode && (
            <button
              type="button"
              className="-ml-1 inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
              style={{ color: "var(--st-ink-3)" }}
              title="Click and hold to drag"
              aria-label={`Drag ${widget.settings?.title || title} to reorder`}
              {...dragHandleAttributes}
              {...dragHandleListeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="st-panel-title truncate">{widget.settings?.title || title}</h2>
            {(widget.settings?.subtitle || subtitle) && (
              <p className="st-row-sub line-clamp-1">{widget.settings?.subtitle || subtitle}</p>
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
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-2"
          style={{
            borderBottom: "1px solid var(--st-line-soft)",
            background: "var(--st-accent-wash)",
          }}
        >
          <span
            className="st-tally rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ border: "1px solid var(--st-line)" }}
          >
            {sizeLabels[widget.size]}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="actsix-btn-outline min-h-10 h-7 px-2 text-[11px]"
            disabled={index === 0}
            onClick={() => onMove("up")}
          >
            <ArrowUp className="h-3 w-3" />
            Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="actsix-btn-outline min-h-10 h-7 px-2 text-[11px]"
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

      {/* No padding here — rows run edge to edge and carry their own. Widgets
          with non-row content wrap themselves in `.st-pad`. */}
      <div
        ref={bodyRef}
        onScroll={syncMoreBelow}
        data-more-below={moreBelow ? "true" : undefined}
        className="st-widget-body flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {children}
      </div>
    </Card>
  );
}
