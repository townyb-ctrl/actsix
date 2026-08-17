import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { setVenueResourceActive } from "@/features/venues/api/venueResourcesApi";
import { useVenueResources } from "@/features/venues/api/venueResourcesQueries";
import { formatCurrency } from "@/features/venues/lib/venueBookings";
import type { VenueResource } from "@/features/venues/lib/venueResources";
import VenueResourceEditorModal from "@/features/venues/components/VenueResourceEditorModal";
import VenueListSkeleton from "@/features/venues/components/VenueListSkeleton";

const UNCATEGORISED = "Uncategorised";

export default function VenueResourcesPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();

  const [editingResource, setEditingResource] = useState<VenueResource | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { resources, loading: resourcesLoading, error } = useVenueResources(workspace?.id);
  const loading = !workspace?.id || resourcesLoading;

  const toastedErrorRef = useRef(false);

  useEffect(() => {
    if (error && !toastedErrorRef.current) {
      toastedErrorRef.current = true;
      toast.error("Could not load resources", { description: error.message });
    }
    if (!error) {
      toastedErrorRef.current = false;
    }
  }, [error]);

  const refreshResources = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-resources"] });
  };

  /** Grouped so a long inventory stays scannable; uncategorised sinks to the end. */
  const grouped = useMemo(() => {
    const groups = new Map<string, VenueResource[]>();

    for (const resource of resources) {
      const key = resource.category.trim() || UNCATEGORISED;
      groups.set(key, [...(groups.get(key) ?? []), resource]);
    }

    return [...groups.entries()].sort(([a], [b]) => {
      if (a === UNCATEGORISED) return 1;
      if (b === UNCATEGORISED) return -1;
      return a.localeCompare(b);
    });
  }, [resources]);

  const openNewResource = () => {
    setEditingResource(null);
    setModalOpen(true);
  };

  const toggleActive = async (resource: VenueResource) => {
    const { error: updateError } = await setVenueResourceActive(resource.id, !resource.is_active);
    if (updateError) {
      toast.error("Could not update the resource", { description: updateError.message });
      return;
    }
    refreshResources();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Venue Hire"
        title="Resources"
        subtitle="Tables, chairs, AV kit, and everything else a hire can ask for."
        actions={
          <Button className="actsix-btn-primary min-h-10" onClick={openNewResource}>
            <Plus className="h-4 w-4" />
            Add resource
          </Button>
        }
      />

      <div className="actsix-page-body actsix-page-stack">
        {loading ? (
          <VenueListSkeleton shape="row" />
        ) : resources.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Boxes className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No resources yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add the tables, chairs, mics, and kitchen equipment you own. Spaces draw from this
                list, and hires ask for what a space has.
              </p>
              <Button className="actsix-btn-primary min-h-10" onClick={openNewResource}>
                Add your first resource
              </Button>
            </CardContent>
          </Card>
        ) : (
          grouped.map(([category, categoryResources]) => (
            <Card key={category} className="actsix-panel st-list">
              {/* Category is the panel header, not a heading floating above a
                  grid: label left, mono tally right, per the Studio panel. */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <h2 className="label-eyebrow">{category}</h2>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {categoryResources.length}
                </span>
              </div>

              {categoryResources.map((resource) => (
                <div
                  key={resource.id}
                  className={`action-row flex flex-wrap items-center gap-3 sm:flex-nowrap ${
                    resource.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{resource.name}</p>
                      {!resource.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>

                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {resource.is_included ? "Included in the hire" : "Charged per unit"}
                      {resource.notes ? ` · ${resource.notes}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="block font-mono text-xs tabular-nums">
                      {resource.quantity > 0
                        ? `${resource.quantity}${resource.unit ? ` ${resource.unit}` : ""}`
                        : "—"}
                    </span>
                    {!resource.is_included && (
                      <span className="mt-0.5 block font-mono text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(resource.unit_price)}
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingResource(resource);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(resource)}>
                      {resource.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          ))
        )}
      </div>

      <VenueResourceEditorModal
        open={modalOpen}
        resource={editingResource}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setModalOpen}
        onSaved={refreshResources}
      />
    </div>
  );
}
