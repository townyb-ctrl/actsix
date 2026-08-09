import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { getVenueBookings, upsertVenueBooking, upsertVenueSpace } from "./venuesApi";

describe("upsertVenueSpace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("inserts a new space with the workspace and creator attached", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueSpace({
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { name: "Main Hall", description: "", capacity: 200, hourly_rate: 250, daily_rate: 1500, color: "" },
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_spaces");
    expect(builder.insert).toHaveBeenCalledWith({
      name: "Main Hall",
      description: "",
      capacity: 200,
      hourly_rate: 250,
      daily_rate: 1500,
      color: "",
      workspace_id: "workspace-1",
      user_id: "user-1",
    });
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("updates an existing space without rewriting its workspace", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueSpace({
      spaceId: "space-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { name: "Renamed Hall" },
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Renamed Hall" })
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "space-1");
    expect(builder.insert).not.toHaveBeenCalled();
  });
});

describe("upsertVenueBooking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("zeroes the money fields on an internal booking", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueBooking({
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: {
        space_id: "space-1",
        title: "Youth night",
        booking_type: "internal",
        starts_at: "2026-08-10T17:00:00.000Z",
        ends_at: "2026-08-10T20:00:00.000Z",
        status: "Confirmed",
        quoted_fee: 900,
        deposit_amount: 300,
        payment_status: "Unpaid",
      },
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_bookings");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_type: "internal",
        quoted_fee: 0,
        deposit_amount: 0,
        payment_status: "Not applicable",
        hirer_contact_id: null,
        hirer_name: "",
        hirer_email: "",
        hirer_phone: "",
      })
    );
  });

  it("keeps the money fields on an external booking", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueBooking({
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: {
        space_id: "space-1",
        title: "Robertson wedding",
        booking_type: "external",
        hirer_name: "Dana Robertson",
        hirer_email: "dana@example.com",
        starts_at: "2026-08-15T09:00:00.000Z",
        ends_at: "2026-08-15T17:00:00.000Z",
        status: "Confirmed",
        quoted_fee: 4500,
        deposit_amount: 1000,
        payment_status: "Deposit paid",
      },
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_type: "external",
        quoted_fee: 4500,
        deposit_amount: 1000,
        payment_status: "Deposit paid",
        hirer_name: "Dana Robertson",
      })
    );
  });

  it("zeroes the money fields on an update to an internal booking", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueBooking({
      bookingId: "booking-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: {
        space_id: "space-1",
        title: "Youth night",
        booking_type: "internal",
        starts_at: "2026-08-10T17:00:00.000Z",
        ends_at: "2026-08-10T20:00:00.000Z",
        status: "Confirmed",
        quoted_fee: 900,
        deposit_amount: 300,
        payment_status: "Unpaid",
      },
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_type: "internal",
        quoted_fee: 0,
        deposit_amount: 0,
        payment_status: "Not applicable",
      })
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "booking-1");
  });
});

describe("getVenueBookings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("filters to the workspace and the requested window", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getVenueBookings({
      workspaceId: "workspace-1",
      fromIso: "2026-08-01T00:00:00.000Z",
      toIso: "2026-08-31T23:59:59.999Z",
    });

    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(builder.gte).toHaveBeenCalledWith("starts_at", "2026-08-01T00:00:00.000Z");
    expect(builder.lte).toHaveBeenCalledWith("starts_at", "2026-08-31T23:59:59.999Z");
  });
});
