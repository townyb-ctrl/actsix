import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { cloneHire, saveHireDebrief } from "./venuePostEventApi";
import type { VenueBooking } from "@/features/venues/lib/venueBookings";

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  hire_id: "hire-1",
  title: "Day 1",
  booking_type: "external",
  hirer_contact_id: null,
  hirer_name: "",
  hirer_email: "",
  hirer_phone: "",
  starts_at: new Date(2026, 8, 11, 9).toISOString(),
  ends_at: new Date(2026, 8, 11, 17).toISOString(),
  status: "Confirmed",
  quoted_fee: 0,
  deposit_amount: 0,
  payment_status: "Not applicable",
  source: "staff",
  requested_features: [],
  needs_technician: false,
  technician_fee: 0,
  coffee_requested: false,
  coffee_fee: 0,
  notes: "",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const hire = {
  event_type: "Conference",
  hirer_contact_id: null,
  hirer_name: "Grace Ministries",
  hirer_email: "hello@example.org",
  hirer_phone: "",
  onsite_contact_name: "",
  onsite_contact_phone: "",
  payment_terms: "50% deposit",
  contract_clauses: "No food in the auditorium.",
  lessons_learned: "Order more chairs.",
  notes: "",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("saveHireDebrief", () => {
  it("writes the debrief onto the hire it belongs to", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    saveHireDebrief("hire-1", { hirer_rating: 4, damage_cost: 250 });

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_hires");
    expect(builder.eq).toHaveBeenCalledWith("id", "hire-1");
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ hirer_rating: 4, damage_cost: 250 })
    );
  });
});

describe("cloneHire", () => {
  const runClone = async (source: Parameters<typeof cloneHire>[0]["source"]) => {
    const builders: Record<string, ReturnType<typeof createQueryBuilder>> = {};
    supabaseMock.from.mockImplementation((table: string) => {
      builders[table] =
        builders[table] ||
        createQueryBuilder(okResult(table === "venue_hires" ? { id: "hire-2" } : null));
      return builders[table];
    });

    const result = await cloneHire({
      workspaceId: "workspace-1",
      userId: "user-1",
      name: "Conference 2027",
      startDay: "2027-09-10",
      hire,
      source,
    });

    return { result, builders };
  };

  const source = {
    bookings: [booking({ id: "b1" })],
    lines: [],
    runSheetItems: [],
    positions: [],
  };

  it("creates the repeat as an unsent draft, whatever state the original ended in", async () => {
    const { result, builders } = await runClone(source);

    expect(result.error).toBeNull();
    expect(result.hireId).toBe("hire-2");
    expect(builders.venue_hires.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Draft", quote_status: "Draft", name: "Conference 2027" })
    );
  });

  it("carries the lessons across, because that is the point of writing them down", async () => {
    const { builders } = await runClone(source);

    expect(builders.venue_hires.insert).toHaveBeenCalledWith(
      expect.objectContaining({ lessons_learned: "Order more chairs." })
    );
  });

  it("never copies a payment, a signature or the debrief", async () => {
    const { builders } = await runClone(source);

    const [inserted] = vi.mocked(builders.venue_hires.insert).mock.calls[0];
    expect(inserted).not.toHaveProperty("contract_signed_on");
    expect(inserted).not.toHaveProperty("contract_signed_by");
    expect(inserted).not.toHaveProperty("debrief_notes");
    expect(inserted).not.toHaveProperty("hirer_rating");
    expect(supabaseMock.from).not.toHaveBeenCalledWith("venue_payments");
  });

  it("attaches the copied bookings to the new hire as pending", async () => {
    const { builders } = await runClone(source);

    const [rows] = vi.mocked(builders.venue_bookings.insert).mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({ hire_id: "hire-2", workspace_id: "workspace-1", status: "Pending" })
    );
  });

  it("skips tables with nothing to copy instead of inserting empty rows", async () => {
    await runClone(source);

    expect(supabaseMock.from).not.toHaveBeenCalledWith("venue_quote_lines");
    expect(supabaseMock.from).not.toHaveBeenCalledWith("venue_run_sheet_items");
    expect(supabaseMock.from).not.toHaveBeenCalledWith("venue_positions");
  });

  it("reports the new hire's id even when a later copy fails, so it is not orphaned silently", async () => {
    const hireBuilder = createQueryBuilder(okResult({ id: "hire-2" }));
    const bookingBuilder = createQueryBuilder({
      data: null,
      error: { message: "insert failed" },
    } as never);

    supabaseMock.from.mockImplementation((table: string) =>
      table === "venue_hires" ? hireBuilder : bookingBuilder
    );

    const result = await cloneHire({
      workspaceId: "workspace-1",
      userId: "user-1",
      name: "Conference 2027",
      startDay: "2027-09-10",
      hire,
      source,
    });

    expect(result.hireId).toBe("hire-2");
    expect(result.error).toEqual({ message: "insert failed" });
  });
});
