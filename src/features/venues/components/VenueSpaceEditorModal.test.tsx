import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VenueSpaceEditorModal from "./VenueSpaceEditorModal";
import { removeSpaceResource, setSpaceResource } from "@/features/venues/api/venueResourcesApi";
import { upsertVenueSpace } from "@/features/venues/api/venuesApi";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";
import type { VenueResource, VenueSpaceResource } from "@/features/venues/lib/venueResources";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock("@/features/venues/api/venuesApi", () => ({
  upsertVenueSpace: vi.fn(),
}));

vi.mock("@/features/venues/api/venueResourcesApi", () => ({
  setSpaceResource: vi.fn(),
  removeSpaceResource: vi.fn(),
}));

const space: VenueSpace = {
  id: "space-1",
  workspace_id: "workspace-1",
  user_id: "user-1",
  name: "Main Hall",
  description: "",
  capacity: 100,
  hourly_rate: 0,
  daily_rate: 0,
  color: "",
  photo_urls: [],
  standing_capacity: null,
  seated_capacity: null,
  floor_plan_url: null,
  hireable_standalone: true,
  setup_minutes: 0,
  packdown_minutes: 0,
  food_allowed: true,
  is_restricted_zone: false,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const resource = (id: string, name: string): VenueResource => ({
  id,
  workspace_id: "workspace-1",
  user_id: "user-1",
  name,
  category: "",
  quantity: 0,
  unit: "",
  is_included: true,
  unit_price: 0,
  notes: "",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const chairs = resource("resource-chairs", "Chairs");
const projector = resource("resource-projector", "Projector");

const existingLink: VenueSpaceResource = {
  id: "link-1",
  workspace_id: "workspace-1",
  space_id: "space-1",
  resource_id: "resource-chairs",
  quantity: 40,
  created_at: "2026-01-01T00:00:00.000Z",
};

const renderModal = (spaceResources: VenueSpaceResource[]) =>
  render(
    <VenueSpaceEditorModal
      open
      space={space}
      resources={[chairs, projector]}
      spaceResources={spaceResources}
      workspaceId="workspace-1"
      userId="user-1"
      onOpenChange={() => {}}
      onSaved={() => {}}
    />
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(upsertVenueSpace).mockResolvedValue({ data: { id: "space-1" }, error: null } as never);
  vi.mocked(setSpaceResource).mockResolvedValue({ error: null } as never);
  vi.mocked(removeSpaceResource).mockResolvedValue({ error: null } as never);
});

describe("VenueSpaceEditorModal resource links", () => {
  it("pre-ticks the resources the space already has, with their quantity", () => {
    renderModal([existingLink]);

    expect(screen.getByLabelText("Chairs")).toBeChecked();
    expect(screen.getByLabelText("Projector")).not.toBeChecked();
    expect(screen.getByLabelText("How many Chairs in this space")).toHaveValue(40);
  });

  it("links a newly ticked resource and keeps the existing one", async () => {
    renderModal([existingLink]);

    fireEvent.click(screen.getByLabelText("Projector"));
    fireEvent.click(screen.getByRole("button", { name: /save space/i }));

    await waitFor(() => expect(setSpaceResource).toHaveBeenCalledTimes(2));

    expect(setSpaceResource).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      spaceId: "space-1",
      resourceId: "resource-projector",
      quantity: 1,
    });
    expect(setSpaceResource).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      spaceId: "space-1",
      resourceId: "resource-chairs",
      quantity: 40,
    });
    expect(removeSpaceResource).not.toHaveBeenCalled();
  });

  it("removes a resource that was unticked", async () => {
    renderModal([existingLink]);

    fireEvent.click(screen.getByLabelText("Chairs"));
    fireEvent.click(screen.getByRole("button", { name: /save space/i }));

    await waitFor(() =>
      expect(removeSpaceResource).toHaveBeenCalledWith({
        spaceId: "space-1",
        resourceId: "resource-chairs",
      })
    );
    expect(setSpaceResource).not.toHaveBeenCalled();
  });

  it("saves the new space attributes alongside the rates", async () => {
    renderModal([]);

    fireEvent.change(screen.getByLabelText("Seated"), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Setup (minutes)"), { target: { value: "45" } });
    fireEvent.click(screen.getByLabelText("Staff-only zone during hires"));
    fireEvent.click(screen.getByRole("button", { name: /save space/i }));

    await waitFor(() => expect(upsertVenueSpace).toHaveBeenCalled());

    expect(vi.mocked(upsertVenueSpace).mock.calls[0][0].payload).toEqual(
      expect.objectContaining({
        seated_capacity: 180,
        setup_minutes: 45,
        is_restricted_zone: true,
        food_allowed: true,
        hireable_standalone: true,
      })
    );
  });
});
