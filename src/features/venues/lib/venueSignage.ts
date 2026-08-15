export type VenueSign = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  body: string;
  placement: string;
  exists_physically: boolean;
  needs_reprint: boolean;
  last_printed_on: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VenueHireSign = {
  id: string;
  workspace_id: string;
  hire_id: string;
  sign_id: string;
  user_id: string;
  quantity: number;
  placement: string;
  prepared: boolean;
  created_at: string;
  updated_at: string;
};

export type VenueAvPreset = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  event_type: string;
  space_id: string | null;
  routing: string;
  changeover_steps: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VenueResourceCheckout = {
  id: string;
  workspace_id: string;
  hire_id: string;
  resource_id: string;
  user_id: string;
  quantity: number;
  taken_by: string;
  taken_at: string;
  /** Null until it comes back - the whole point of the log. */
  returned_at: string | null;
  condition_note: string;
  created_at: string;
  updated_at: string;
};

export type SignPlanEntry = {
  link: VenueHireSign;
  sign: VenueSign;
  /** The hire's placement wins; the library's is the fallback. */
  placement: string;
  /** True when this sign has to be printed before the day. */
  needsPrinting: boolean;
};

/**
 * What signage this hire needs, and which of it does not physically exist yet.
 *
 * A sign needs printing when the church does not have it, or has it but has
 * marked it for reprint. Links whose sign has been deleted or deactivated are
 * dropped rather than rendered as a blank row.
 */
export const signPlan = (links: VenueHireSign[], signs: VenueSign[]): SignPlanEntry[] =>
  links
    .map((link) => {
      const sign = signs.find((entry) => entry.id === link.sign_id);
      if (!sign || !sign.is_active) return null;

      return {
        link,
        sign,
        placement: link.placement.trim() || sign.placement,
        needsPrinting: !sign.exists_physically || sign.needs_reprint,
      };
    })
    .filter((entry): entry is SignPlanEntry => entry !== null)
    .sort((a, b) => a.sign.name.localeCompare(b.sign.name));

/** How many sheets a print run produces, counting quantities. */
export const printRunSize = (entries: SignPlanEntry[]): number =>
  entries.filter((entry) => entry.needsPrinting).reduce((total, entry) => total + entry.link.quantity, 0);

/**
 * The preset that best fits a hire.
 *
 * A preset naming this event type beats a general one, and among those, one
 * tied to a space this hire is actually using beats one that is not. Returns
 * null rather than guessing when nothing matches - a wrong AV setup is worse
 * than no suggestion.
 */
export const suggestAvPreset = (
  presets: VenueAvPreset[],
  eventType: string,
  spaceIds: string[]
): VenueAvPreset | null => {
  const active = presets.filter((preset) => preset.is_active);
  const type = eventType.trim().toLowerCase();
  if (!type) return null;

  const matching = active.filter((preset) => preset.event_type.trim().toLowerCase() === type);
  if (matching.length === 0) return null;

  return (
    matching.find((preset) => preset.space_id && spaceIds.includes(preset.space_id)) ||
    matching.find((preset) => !preset.space_id) ||
    matching[0]
  );
};

export type CheckoutSummary = {
  out: number;
  returned: number;
  /** True while anything is still signed out - the thing worth a badge. */
  anythingOut: boolean;
};

export const checkoutSummary = (checkouts: VenueResourceCheckout[]): CheckoutSummary => {
  const out = checkouts.filter((entry) => !entry.returned_at).length;

  return {
    out,
    returned: checkouts.length - out,
    anythingOut: out > 0,
  };
};
