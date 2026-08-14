import { describe, expect, it } from "vitest";

import {
  resourcesForSpace,
  type VenueResource,
  type VenueSpaceResource,
} from "./venueResources";

const resource = (overrides: Partial<VenueResource> & { id: string }): VenueResource => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  name: "Projector",
  category: "AV",
  quantity: 1,
  unit: "",
  is_included: true,
  unit_price: 0,
  notes: "",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const link = (
  overrides: Partial<VenueSpaceResource> & { id: string; space_id: string; resource_id: string }
): VenueSpaceResource => ({
  workspace_id: "workspace-1",
  quantity: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("resourcesForSpace", () => {
  it("returns only the resources linked to that space", () => {
    const projector = resource({ id: "r1", name: "Projector" });
    const kettle = resource({ id: "r2", name: "Kettle" });

    const result = resourcesForSpace(
      "hall",
      [link({ id: "l1", space_id: "hall", resource_id: "r1" })],
      [projector, kettle]
    );

    expect(result).toEqual([{ resource: projector, quantity: 1 }]);
  });

  it("sorts by resource name so the checklist order is stable", () => {
    const links = [
      link({ id: "l1", space_id: "hall", resource_id: "r1" }),
      link({ id: "l2", space_id: "hall", resource_id: "r2" }),
    ];

    const result = resourcesForSpace("hall", links, [
      resource({ id: "r1", name: "Projector" }),
      resource({ id: "r2", name: "Kettle" }),
    ]);

    expect(result.map((entry) => entry.resource.name)).toEqual(["Kettle", "Projector"]);
  });

  it("carries the per-space quantity, not the inventory total", () => {
    const result = resourcesForSpace(
      "hall",
      [link({ id: "l1", space_id: "hall", resource_id: "r1", quantity: 40 })],
      [resource({ id: "r1", name: "Chairs", quantity: 300 })]
    );

    expect(result[0].quantity).toBe(40);
  });

  it("skips deactivated resources", () => {
    const result = resourcesForSpace(
      "hall",
      [link({ id: "l1", space_id: "hall", resource_id: "r1" })],
      [resource({ id: "r1", is_active: false })]
    );

    expect(result).toEqual([]);
  });

  it("skips links whose resource is missing", () => {
    const result = resourcesForSpace(
      "hall",
      [link({ id: "l1", space_id: "hall", resource_id: "gone" })],
      []
    );

    expect(result).toEqual([]);
  });

  it("returns nothing for a space with no links", () => {
    expect(resourcesForSpace("chapel", [], [resource({ id: "r1" })])).toEqual([]);
    expect(resourcesForSpace("", [], [])).toEqual([]);
  });
});
