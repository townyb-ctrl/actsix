import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DashboardWidgetDefinition,
  WidgetCategory,
} from "@/features/dashboard/types/dashboardTypes";

const categories: WidgetCategory[] = [
  "Tasks",
  "Services",
  "People",
  "Meetings",
  "Projects",
  "Events",
  "Finance",
  "Files",
  "Personal",
];

type WidgetLibraryModalProps = {
  open: boolean;
  definitions: DashboardWidgetDefinition[];
  onOpenChange: (open: boolean) => void;
  onAddWidget: (definitionId: string) => void;
};

export function WidgetLibraryModal({
  open,
  definitions,
  onOpenChange,
  onAddWidget,
}: WidgetLibraryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Widget Library</DialogTitle>
          <DialogDescription>
            Choose ministry signals to add to your dashboard. Widgets snap into a structured grid.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[64vh] space-y-5 overflow-y-auto pr-1">
          {categories.map((category) => {
            const categoryWidgets = definitions.filter((definition) => definition.category === category);

            return (
              <section key={category} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-foreground">{category}</h3>
                  <span className="h-px flex-1 bg-border/70" />
                </div>

                {categoryWidgets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-background/60 px-3 py-2 text-sm font-semibold text-muted-foreground">
                    No widgets in this category yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryWidgets.map((definition) => (
                      <div
                        key={definition.id}
                        className="flex min-h-[132px] flex-col justify-between rounded-xl border border-border/80 bg-background/80 p-3"
                      >
                        <div>
                          <h4 className="text-sm font-extrabold text-foreground">{definition.title}</h4>
                          <p className="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-muted-foreground">
                            {definition.description}
                          </p>
                        </div>
                        <Button
                          className="actsix-btn-primary mt-3 h-8 w-full px-3 text-xs"
                          onClick={() => {
                            onAddWidget(definition.id);
                            onOpenChange(false);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Widget
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
