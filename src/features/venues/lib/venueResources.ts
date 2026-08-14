export type VenueResource = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  category: string;
  /** How many the church owns. 0 means "not counted", not "none". */
  quantity: number;
  unit: string;
  /** Included in the base hire fee, or charged on top. */
  is_included: boolean;
  unit_price: number;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VenueSpaceResource = {
  id: string;
  workspace_id: string;
  space_id: string;
  resource_id: string;
  quantity: number;
  created_at: string;
};

export type SpaceResource = {
  resource: VenueResource;
  /** How many of it this space comes with - not the workspace-wide total. */
  quantity: number;
};

/**
 * The resources a space comes with, name-sorted so the booking checklist keeps
 * a stable order. A link whose resource has been deactivated or deleted is
 * dropped rather than rendered as a blank row.
 */
export const resourcesForSpace = (
  spaceId: string,
  links: VenueSpaceResource[],
  resources: VenueResource[]
): SpaceResource[] => {
  if (!spaceId) return [];

  const byId = new Map(resources.map((resource) => [resource.id, resource]));

  return links
    .filter((link) => link.space_id === spaceId)
    .flatMap((link) => {
      const resource = byId.get(link.resource_id);
      if (!resource || !resource.is_active) return [];
      return [{ resource, quantity: link.quantity }];
    })
    .sort((a, b) => a.resource.name.localeCompare(b.resource.name));
};
