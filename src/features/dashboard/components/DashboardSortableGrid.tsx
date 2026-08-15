import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  DashboardWidgetSlot,
  type DashboardWidgetSlotProps,
} from "@/features/dashboard/components/DashboardWidgetSlot";
import type { DashboardGridContentProps } from "@/features/dashboard/components/DashboardGrid";

type SortableSlotProps = Omit<
  DashboardWidgetSlotProps,
  "dragRef" | "dragStyle" | "isDragging" | "dragHandleAttributes" | "dragHandleListeners"
>;

function SortableDashboardWidget(props: SortableSlotProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.widget.id,
    disabled: !props.customizeMode,
    transition: {
      duration: 240,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  });

  return (
    <DashboardWidgetSlot
      {...props}
      dragRef={setNodeRef}
      dragStyle={{ transform: CSS.Transform.toString(transform), transition }}
      isDragging={isDragging}
      dragHandleAttributes={attributes}
      dragHandleListeners={listeners}
    />
  );
}

/**
 * The drag-and-drop dashboard. Loaded only once customize mode is switched on,
 * which keeps @dnd-kit out of the bundle every ordinary dashboard visit pays for.
 */
export default function DashboardSortableGrid({
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
}: DashboardGridContentProps) {
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
