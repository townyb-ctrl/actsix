import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { getVenueSpaces, setVenueSpaceActive } from "@/features/venues/api/venuesApi";
import { formatCurrency, type VenueSpace } from "@/features/venues/lib/venueBookings";
import VenueSpaceEditorModal from "@/features/venues/components/VenueSpaceEditorModal";

export default function VenueSpacesPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();

  const [spaces, setSpaces] = useState<VenueSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSpace, setEditingSpace] = useState<VenueSpace | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadSpaces = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    const { data, error } = await getVenueSpaces(workspace.id);
    if (error) {
      toast.error("Could not load spaces", { description: error.message });
    }
    setSpaces((data as VenueSpace[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSpaces();
  }, [workspace?.id]);

  const toggleActive = async (space: VenueSpace) => {
    const { error } = await setVenueSpaceActive(space.id, !space.is_active);
    if (error) {
      toast.error("Could not update the space", { description: error.message });
      return;
    }
    loadSpaces();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Spaces</h1>
          <p className="text-sm text-muted-foreground">
            The rooms and halls that can be booked or hired.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingSpace(null);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add space
        </Button>
      </div>

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

      <VenueSpaceEditorModal
        open={modalOpen}
        space={editingSpace}
        workspaceId={workspace?.id || ""}
        userId={user?.id || ""}
        onOpenChange={setModalOpen}
        onSaved={loadSpaces}
      />
    </div>
  );
}
