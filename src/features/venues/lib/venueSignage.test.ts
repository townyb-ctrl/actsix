import { describe, expect, it } from "vitest";

import {
  checkoutSummary,
  printRunSize,
  signPlan,
  suggestAvPreset,
  type VenueAvPreset,
  type VenueHireSign,
  type VenueResourceCheckout,
  type VenueSign,
} from "./venueSignage";

const sign = (overrides: Partial<VenueSign> & { id: string }): VenueSign => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  name: "Parking this way",
  body: "Parking →",
  placement: "Gate",
  exists_physically: true,
  needs_reprint: false,
  last_printed_on: null,
  is_active: true,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const link = (overrides: Partial<VenueHireSign> & { id: string }): VenueHireSign => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  sign_id: "sign-1",
  user_id: "user-1",
  quantity: 1,
  placement: "",
  prepared: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const preset = (overrides: Partial<VenueAvPreset> & { id: string }): VenueAvPreset => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  name: "Conference default",
  event_type: "Conference",
  space_id: null,
  routing: "",
  changeover_steps: "",
  is_active: true,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const checkout = (
  overrides: Partial<VenueResourceCheckout> & { id: string }
): VenueResourceCheckout => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  resource_id: "resource-1",
  user_id: "user-1",
  quantity: 1,
  taken_by: "Dana",
  taken_at: "2026-09-11T08:00:00.000Z",
  returned_at: null,
  condition_note: "",
  created_at: "2026-09-11T08:00:00.000Z",
  updated_at: "2026-09-11T08:00:00.000Z",
  ...overrides,
});

describe("signPlan", () => {
  it("uses the hire's placement over the library's", () => {
    const plan = signPlan(
      [link({ id: "l1", placement: "Front door" })],
      [sign({ id: "sign-1" })]
    );

    expect(plan[0].placement).toBe("Front door");
  });

  it("falls back to the library placement when the hire says nothing", () => {
    const plan = signPlan([link({ id: "l1" })], [sign({ id: "sign-1" })]);

    expect(plan[0].placement).toBe("Gate");
  });

  it("marks a sign the church does not have as needing printing", () => {
    const plan = signPlan([link({ id: "l1" })], [sign({ id: "sign-1", exists_physically: false })]);

    expect(plan[0].needsPrinting).toBe(true);
  });

  it("marks an existing sign flagged for reprint as needing printing", () => {
    const plan = signPlan(
      [link({ id: "l1" })],
      [sign({ id: "sign-1", exists_physically: true, needs_reprint: true })]
    );

    expect(plan[0].needsPrinting).toBe(true);
  });

  it("leaves a sign the church already has alone", () => {
    const plan = signPlan([link({ id: "l1" })], [sign({ id: "sign-1" })]);

    expect(plan[0].needsPrinting).toBe(false);
  });

  it("drops a link whose sign was deleted or retired", () => {
    expect(signPlan([link({ id: "l1" })], [])).toEqual([]);
    expect(signPlan([link({ id: "l1" })], [sign({ id: "sign-1", is_active: false })])).toEqual([]);
  });

  it("orders by sign name", () => {
    const plan = signPlan(
      [link({ id: "l1", sign_id: "b" }), link({ id: "l2", sign_id: "a" })],
      [sign({ id: "b", name: "Zebra" }), sign({ id: "a", name: "Apple" })]
    );

    expect(plan.map((entry) => entry.sign.name)).toEqual(["Apple", "Zebra"]);
  });
});

describe("printRunSize", () => {
  it("counts quantities, not rows, and only what needs printing", () => {
    const plan = signPlan(
      [
        link({ id: "l1", sign_id: "missing", quantity: 3 }),
        link({ id: "l2", sign_id: "have", quantity: 5 }),
      ],
      [sign({ id: "missing", name: "A", exists_physically: false }), sign({ id: "have", name: "B" })]
    );

    expect(printRunSize(plan)).toBe(3);
  });

  it("is zero when the church has everything", () => {
    const plan = signPlan([link({ id: "l1" })], [sign({ id: "sign-1" })]);

    expect(printRunSize(plan)).toBe(0);
  });
});

describe("suggestAvPreset", () => {
  it("matches on event type", () => {
    const found = suggestAvPreset([preset({ id: "p1" })], "Conference", []);

    expect(found?.id).toBe("p1");
  });

  it("ignores casing and stray spacing", () => {
    expect(suggestAvPreset([preset({ id: "p1" })], "  conference ", [])?.id).toBe("p1");
  });

  it("prefers a preset tied to a space this hire is using", () => {
    const found = suggestAvPreset(
      [preset({ id: "general" }), preset({ id: "hall", name: "Hall conf", space_id: "hall" })],
      "Conference",
      ["hall"]
    );

    expect(found?.id).toBe("hall");
  });

  it("ignores a preset for a space this hire is not using", () => {
    const found = suggestAvPreset(
      [preset({ id: "general" }), preset({ id: "chapel", name: "Chapel conf", space_id: "chapel" })],
      "Conference",
      ["hall"]
    );

    expect(found?.id).toBe("general");
  });

  it("suggests nothing rather than guessing when no type matches", () => {
    expect(suggestAvPreset([preset({ id: "p1" })], "Wedding", [])).toBeNull();
    expect(suggestAvPreset([preset({ id: "p1" })], "", [])).toBeNull();
  });

  it("never suggests a retired preset", () => {
    expect(suggestAvPreset([preset({ id: "p1", is_active: false })], "Conference", [])).toBeNull();
  });
});

describe("checkoutSummary", () => {
  it("counts what is still out", () => {
    const summary = checkoutSummary([
      checkout({ id: "c1" }),
      checkout({ id: "c2", returned_at: "2026-09-12T08:00:00.000Z" }),
    ]);

    expect(summary).toEqual({ out: 1, returned: 1, anythingOut: true });
  });

  it("is quiet when everything is back", () => {
    const summary = checkoutSummary([
      checkout({ id: "c1", returned_at: "2026-09-12T08:00:00.000Z" }),
    ]);

    expect(summary.anythingOut).toBe(false);
  });

  it("is quiet when nothing ever went out", () => {
    expect(checkoutSummary([])).toEqual({ out: 0, returned: 0, anythingOut: false });
  });
});
