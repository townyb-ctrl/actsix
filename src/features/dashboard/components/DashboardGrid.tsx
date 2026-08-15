import { Suspense, lazy } from "react";

import type {
  DashboardWidgetData,
  DashboardWidgetDefinition,
  DashboardWidgetSettings,
  UserDashboardWidget,
  WidgetSize,
} from "@/features/dashboard/types/dashboardTypes";
import { DashboardWidgetSlot } from "@/features/dashboard/components/DashboardWidgetSlot";

// Dragging widgets around is a customize-mode-only affair, so @dnd-kit (~46 kB)
// is fetched the first time someone turns customize mode on rather than on
// every dashboard load.
const DashboardSortableGrid = lazy(
  () => import("@/features/dashboard/components/DashboardSortableGrid")
);

export type DashboardGridContentProps = {
  widgets: UserDashboardWidget[];
  definitions: DashboardWidgetDefinition[];
  data: DashboardWidgetData;
  customizeMode: boolean;
  onMoveWidget: (widgetId: string, direction: "up" | "down") => void;
  onReorderWidget: (activeWidgetId: string, overWidgetId: string) => void;
  onResizeWidget: (widgetId: string, size: WidgetSize) => void;
  onRemoveWidget: (widgetId: string) => void;
  onConfigureWidget: (widget: UserDashboardWidget) => void;
  onUpdateWidgetSettings: (widgetId: string, settings: DashboardWidgetSettings) => void;
};

function StaticDashboardGrid({
  widgets,
  definitions,
  data,
  customizeMode,
  onMoveWidget,
  onResizeWidget,
  onRemoveWidget,
  onConfigureWidget,
  onUpdateWidgetSettings,
}: DashboardGridContentProps) {
  return (
    <section className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-12 md:auto-rows-[76px]">
      {widgets.map((widget, index) => {
        const definition = definitions.find((item) => item.id === widget.definitionId);
        if (!definition) return null;

        return (
          <DashboardWidgetSlot
            key={widget.id}
            widget={widget}
            definition={definition}
            data={data}
            customizeMode={customizeMode}
            index={index}
            totalWidgets={widgets.length}
            onMoveWidget={onMoveWidget}
            onResizeWidget={onResizeWidget}
            onRemoveWidget={onRemoveWidget}
            onConfigureWidget={onConfigureWidget}
            onUpdateWidgetSettings={onUpdateWidgetSettings}
          />
        );
      })}
    </section>
  );
}

export function DashboardGrid(props: DashboardGridContentProps) {
  if (props.widgets.length === 0) {
    return (
      <div className="actsix-empty-state">
        No dashboard widgets yet. Add a widget to shape your command center.
      </div>
    );
  }

  if (!props.customizeMode) {
    return <StaticDashboardGrid {...props} />;
  }

  // The plain grid stands in while the drag bundle arrives, so switching into
  // customize mode never blanks the dashboard.
  return (
    <Suspense fallback={<StaticDashboardGrid {...props} />}>
      <DashboardSortableGrid {...props} />
    </Suspense>
  );
}
