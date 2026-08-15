import type { CSSProperties, Ref } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

import type {
  DashboardWidgetData,
  DashboardWidgetDefinition,
  DashboardWidgetSettings,
  UserDashboardWidget,
  WidgetSize,
} from "@/features/dashboard/types/dashboardTypes";
import { DashboardWidgetCard } from "@/features/dashboard/components/DashboardWidgetCard";
import { cn } from "@/lib/utils";

const widgetSizeClasses: Record<WidgetSize, string> = {
  small: "md:col-span-6 xl:col-span-3 md:row-span-2",
  medium: "md:col-span-6 xl:col-span-4 md:row-span-3",
  large: "md:col-span-12 xl:col-span-6 md:row-span-4",
  full: "md:col-span-12 xl:col-span-12 md:row-span-3",
};

export type DashboardWidgetSlotProps = {
  widget: UserDashboardWidget;
  definition: DashboardWidgetDefinition;
  data: DashboardWidgetData;
  customizeMode: boolean;
  index: number;
  totalWidgets: number;
  onMoveWidget: (widgetId: string, direction: "up" | "down") => void;
  onResizeWidget: (widgetId: string, size: WidgetSize) => void;
  onRemoveWidget: (widgetId: string) => void;
  onConfigureWidget: (widget: UserDashboardWidget) => void;
  onUpdateWidgetSettings: (widgetId: string, settings: DashboardWidgetSettings) => void;
  /** Only supplied by the sortable grid; the read-only grid renders a plain cell. */
  dragRef?: Ref<HTMLDivElement>;
  dragStyle?: CSSProperties;
  isDragging?: boolean;
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: SyntheticListenerMap;
};

/**
 * One dashboard cell. Shared by the plain grid and the drag-and-drop grid so
 * that only the drag wiring lives in the lazily loaded @dnd-kit bundle.
 */
export function DashboardWidgetSlot({
  widget,
  definition,
  data,
  customizeMode,
  index,
  totalWidgets,
  onMoveWidget,
  onResizeWidget,
  onRemoveWidget,
  onConfigureWidget,
  onUpdateWidgetSettings,
  dragRef,
  dragStyle,
  isDragging,
  dragHandleAttributes,
  dragHandleListeners,
}: DashboardWidgetSlotProps) {
  const WidgetComponent = definition.component;

  return (
    <div
      ref={dragRef}
      style={dragStyle}
      className={cn(
        "min-w-0 will-change-transform transition-[opacity,transform] duration-200 md:min-h-0",
        widgetSizeClasses[widget.size],
        isDragging && "z-20 scale-[1.01] opacity-90"
      )}
    >
      <DashboardWidgetCard
        widget={widget}
        title={definition.title}
        subtitle={definition.subtitle}
        customizeMode={customizeMode}
        index={index}
        totalWidgets={totalWidgets}
        onMove={(direction) => onMoveWidget(widget.id, direction)}
        onResize={(size) => onResizeWidget(widget.id, size)}
        onRemove={() => onRemoveWidget(widget.id)}
        onConfigure={() => onConfigureWidget(widget)}
        dragHandleAttributes={dragHandleAttributes}
        dragHandleListeners={dragHandleListeners}
      >
        <WidgetComponent
          widget={widget}
          data={data}
          updateSettings={(settings) => onUpdateWidgetSettings(widget.id, settings)}
        />
      </DashboardWidgetCard>
    </div>
  );
}
