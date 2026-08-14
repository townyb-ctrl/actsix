import { useEffect, useRef, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { setVenueSpaceActive, setVenueRequestToken } from "@/features/venues/api/venuesApi";
import { useVenueRequestToken, useVenueSpaces } from "@/features/venues/api/venuesQueries";
import {
  useVenueResources,
  useVenueSpaceResources,
} from "@/features/venues/api/venueResourcesQueries";
import { formatCurrency, type VenueSpace } from "@/features/venues/lib/venueBookings";
import { resourcesForSpace } from "@/features/venues/lib/venueResources";
import VenueSpaceEditorModal from "@/features/venues/components/VenueSpaceEditorModal";

export default function VenueSpacesPage() {
  const { user } = useAuth();
  const { workspace, isAdmin } = useCurrentWorkspace();
  const queryClient = useQueryClient();

  const [editingSpace, setEditingSpace] = useState<VenueSpace | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { spaces, loading: spacesLoading, error: spacesError } = useVenueSpaces(workspace?.id);
  const { resources } = useVenueResources(workspace?.id);
  const { spaceResources } = useVenueSpaceResources(workspace?.id);
  const { requestToken } = useVenueRequestToken(workspace?.id);
  const loading = !workspace?.id || spacesLoading;

  const toastedErrorRef = useRef(false);

  useEffect(() => {
    if (spacesError && !toastedErrorRef.current) {
      toastedErrorRef.current = true;
      toast.error("Could not load spaces", { description: spacesError.message });
    }
    if (!spacesError) {
      toastedErrorRef.current = false;
    }
  }, [spacesError]);

  const refreshSpaces = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-spaces"] });
    queryClient.invalidateQueries({ queryKey: ["venue-space-resources"] });
  };

  const requestUrl = requestToken ? `${window.location.origin}/venue-request/${requestToken}` : "";

  const toggleRequestLink = async () => {
    if (!workspace?.id) return;
    const nextToken = requestToken ? null : crypto.randomUUID().replace(/-/g, "");
    const { data, error } = await setVenueRequestToken(workspace.id, nextToken);
    if (error) {
      toast.error("Could not update the request link", { description: error.message });
      return;
    }
    if (!data || (data as unknown[]).length === 0) {
      toast.error("Could not update the request link", {
        description: "You may not have permission to change this workspace's settings.",
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["venue-request-token"] });
    toast.success(nextToken ? "Request link created" : "Request link revoked");
  };

  const toggleActive = async (space: VenueSpace) => {
    const { error } = await setVenueSpaceActive(space.id, !space.is_active);
    if (error) {
      toast.error("Could not update the space", { description: error.message });
      return;
    }
    refreshSpaces();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Venue Hire"
        title="Spaces"
        subtitle="The rooms and halls that can be booked or hired."
        actions={
          <Button
            className="actsix-btn-primary min-h-10"
            onClick={() => {
              setEditingSpace(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add space
          </Button>
        }
      />

      <div className="actsix-page-body actsix-page-stack">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="font-medium">Public request link</p>
              <p className="text-sm text-muted-foreground">
                {requestToken
                  ? "Anyone with this link can send a hire request. Requests arrive as Pending."
                  : "Off. Turn it on to let outsiders request a space themselves."}
              </p>
              {requestToken && (
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{requestUrl}</p>
              )}
            </div>
            <div className="flex gap-2">
              {requestToken && (
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(requestUrl);
                    toast.success("Link copied");
                  }}
                >
                  Copy link
                </Button>
              )}
              {isAdmin && (
                <Button variant={requestToken ? "ghost" : "default"} onClick={toggleRequestLink}>
                  {requestToken ? "Revoke link" : "Create link"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading spaces…</p>
        ) : spaces.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No spaces yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add the hall, chapel, or meeting rooms people book. You need at least one space
                before anything can be booked.
              </p>
              <Button
                className="actsix-btn-primary min-h-10"
                onClick={() => {
                  setEditingSpace(null);
                  setModalOpen(true);
                }}
              >
                Add your first space
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => (
              <Card key={space.id} className={space.is_active ? "" : "opacity-60"}>
                {space.photo_urls?.[0] && (
                  <img
                    src={space.photo_urls[0]}
                    alt=""
                    className="h-32 w-full rounded-t-[1rem] object-cover"
                  />
                )}
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <CardTitle className="text-base">{space.name}</CardTitle>
                  {!space.is_active && <Badge variant="secondary">Inactive</Badge>}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {space.description && <p className="text-muted-foreground">{space.description}</p>}
                  <dl className="space-y-1 text-muted-foreground">
                    {space.capacity != null && (
                      <div className="flex justify-between">
                        <dt>Capacity</dt>
                        <dd>{space.capacity}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt>Hourly hire</dt>
                      <dd>{formatCurrency(space.hourly_rate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Daily hire</dt>
                      <dd>{formatCurrency(space.daily_rate)}</dd>
                    </div>
                  </dl>
                  {(() => {
                    const spaceResourceList = resourcesForSpace(space.id, spaceResources, resources);
                    if (spaceResourceList.length === 0) return null;

                    return (
                      <div className="flex flex-wrap gap-1">
                        {spaceResourceList.map(({ resource, quantity }) => (
                          <Badge key={resource.id} variant="outline" className="font-normal">
                            {resource.name}
                            {quantity > 1 ? ` ×${quantity}` : ""}
                          </Badge>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSpace(space);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(space)}>
                      {space.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <VenueSpaceEditorModal
        open={modalOpen}
        space={editingSpace}
        resources={resources}
        spaceResources={spaceResources}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setModalOpen}
        onSaved={refreshSpaces}
      />
    </div>
  );
}
