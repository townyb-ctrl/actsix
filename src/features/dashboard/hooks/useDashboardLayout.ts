import { useEffect, useMemo, useState } from "react";
import type {
  DashboardWidgetDefinition,
  DashboardWidgetSettings,
  UserDashboardLayout,
  WidgetSize,
} from "@/features/dashboard/types/dashboardTypes";
import { defaultDashboardLayout } from "@/features/dashboard/data/defaultDashboardLayouts";
import {
  createDashboardLayout,
  createWidgetInstance,
  moveWidget,
  normalizeDashboardLayout,
  reorderWidgets,
  resizeWidget,
  touchLayout,
} from "@/features/dashboard/utils/dashboardLayoutUtils";

const STORAGE_PREFIX = "actsix:dashboard-layout";

const readLayout = (storageKey: string): UserDashboardLayout | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as UserDashboardLayout) : null;
  } catch {
    return null;
  }
};

const writeLayout = (storageKey: string, layout: UserDashboardLayout) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(layout));
};

export const useDashboardLayout = (
  userId: string | undefined,
  definitions: DashboardWidgetDefinition[]
) => {
  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${userId || "anonymous"}`, [userId]);
  const [layout, setLayout] = useState<UserDashboardLayout>(() =>
    normalizeDashboardLayout(readLayout(storageKey), defaultDashboardLayout, definitions)
  );
  const [savedState, setSavedState] = useState<"saved" | "saving">("saved");

  useEffect(() => {
    setLayout(normalizeDashboardLayout(readLayout(storageKey), defaultDashboardLayout, definitions));
  }, [definitions, storageKey]);

  useEffect(() => {
    setSavedState("saving");
    writeLayout(storageKey, layout);

    const timer = window.setTimeout(() => setSavedState("saved"), 450);
    return () => window.clearTimeout(timer);
  }, [layout, storageKey]);

  const addWidget = (definitionId: string) => {
    const definition = definitions.find((item) => item.id === definitionId);
    if (!definition) return;

    setLayout((current) =>
      touchLayout({
        ...current,
        widgets: [...current.widgets, createWidgetInstance(definition)],
      })
    );
  };

  const removeWidget = (widgetId: string) => {
    setLayout((current) =>
      touchLayout({
        ...current,
        widgets: current.widgets.filter((widget) => widget.id !== widgetId),
      })
    );
  };

  const moveWidgetById = (widgetId: string, direction: "up" | "down") => {
    setLayout((current) =>
      touchLayout({
        ...current,
        widgets: moveWidget(current.widgets, widgetId, direction),
      })
    );
  };

  const reorderWidget = (activeWidgetId: string, overWidgetId: string) => {
    setLayout((current) =>
      touchLayout({
        ...current,
        widgets: reorderWidgets(current.widgets, activeWidgetId, overWidgetId),
      })
    );
  };

  const resizeWidgetById = (widgetId: string, size: WidgetSize) => {
    setLayout((current) =>
      touchLayout({
        ...current,
        widgets: resizeWidget(current.widgets, widgetId, size),
      })
    );
  };

  const updateWidgetSettings = (widgetId: string, settings: DashboardWidgetSettings) => {
    setLayout((current) =>
      touchLayout({
        ...current,
        widgets: current.widgets.map((widget) =>
          widget.id === widgetId
            ? {
                ...widget,
                settings: {
                  ...widget.settings,
                  ...settings,
                },
              }
            : widget
        ),
      })
    );
  };

  const resetLayout = () => {
    setLayout(createDashboardLayout(defaultDashboardLayout.widgets));
  };

  return {
    layout,
    savedState,
    addWidget,
    removeWidget,
    moveWidget: moveWidgetById,
    reorderWidget,
    resizeWidget: resizeWidgetById,
    updateWidgetSettings,
    resetLayout,
  };
};
