import type {
  DashboardWidgetData,
  DashboardWidgetDefinition,
  DashboardWidgetSettings,
  UserDashboardWidget,
  WidgetSize,
} from "@/features/dashboard/types/dashboardTypes";
import { DashboardWidgetCard } from "@/features/dashboard/components/DashboardWidgetCard";
import { cn } from "@/lib/utils";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const sizeClasses: Record<WidgetSize, string> = {
  small: "md:col-span-6 xl:col-span-3 md:row-span-2",
  medium: "md:col-span-6 xl:col-span-4 md:row-span-3",
  large: "md:col-span-12 xl:col-span-6 md:row-span-4",
  full: "md:col-span-12 xl:col-span-12 md:row-span-3",
};

type DashboardGridProps = {
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

type SortableDashboardWidgetProps = {
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
};

function SortableDashboardWidget({
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
}: SortableDashboardWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: widget.id,
    disabled: !customizeMode,
    transition: {
      duration: 240,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  });
  const WidgetComponent = definition.component;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "min-w-0 will-change-transform transition-[opacity,transform] duration-200 md:min-h-0",
        sizeClasses[widget.size],
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
        dragHandleAttributes={attributes}
        dragHandleListeners={listeners}
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

export function DashboardGrid({
  widgets,
  definitions,
  data,
  customizeMode,
  onMoveWidget,
  onReorderWidget,
  onResizeWidget,
  onRemoveWidget,
  onConfigureWidget,
  onUpdateWidgetSettings,
}: DashboardGridProps) {
  const widgetDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleWidgetDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;
    onReorderWidget(String(active.id), String(over.id));
  };

  if (widgets.length === 0) {
    return (
      <div className="actsix-empty-state">
        No dashboard widgets yet. Add a widget to shape your command center.
      </div>
    );
  }

  return (
    <DndContext
      sensors={widgetDragSensors}
      collisionDetection={closestCenter}
      onDragEnd={handleWidgetDragEnd}
    >
      <SortableContext items={widgets.map((widget) => widget.id)} strategy={rectSortingStrategy}>
        <section className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-12 md:auto-rows-[76px]">
          {widgets.map((widget, index) => {
            const definition = definitions.find((item) => item.id === widget.definitionId);
            if (!definition) return null;

            return (
              <SortableDashboardWidget
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
      </SortableContext>
    </DndContext>
  );
}
