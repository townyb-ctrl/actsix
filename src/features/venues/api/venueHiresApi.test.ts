import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  getBookingsForHire,
  getVenueHires,
  setBookingHire,
  updateVenueHireStatus,
  upsertVenueHire,
} from "./venueHiresApi";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getVenueHires", () => {
  it("filters to the workspace, newest first", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getVenueHires("workspace-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_hires");
    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("falls back to an impossible workspace rather than reading every row", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getVenueHires(null);

    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "00000000-0000-0000-0000-000000000000");
  });
});

describe("getBookingsForHire", () => {
  it("reads only that hire's bookings, earliest first", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getBookingsForHire("hire-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_bookings");
    expect(builder.eq).toHaveBeenCalledWith("hire_id", "hire-1");
    expect(builder.order).toHaveBeenCalledWith("starts_at", { ascending: true });
  });
});

describe("upsertVenueHire", () => {
  it("inserts with the workspace and creator attached, returning the new id", () => {
    const builder = createQueryBuilder(okResult({ id: "hire-1" }));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueHire({
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { name: "Nationals weekend", event_type: "Competition" },
    });

    expect(builder.insert).toHaveBeenCalledWith({
      name: "Nationals weekend",
      event_type: "Competition",
      workspace_id: "workspace-1",
      user_id: "user-1",
    });
    expect(builder.select).toHaveBeenCalledWith("id");
    expect(builder.single).toHaveBeenCalled();
  });

  it("updates an existing hire without rewriting its workspace", () => {
    const builder = createQueryBuilder(okResult({ id: "hire-1" }));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueHire({
      hireId: "hire-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { name: "Renamed" },
    });

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(expect.objectContaining({ name: "Renamed" }));
    expect(update).not.toHaveProperty("workspace_id");
    expect(builder.eq).toHaveBeenCalledWith("id", "hire-1");
    expect(builder.insert).not.toHaveBeenCalled();
  });
});

describe("updateVenueHireStatus", () => {
  it("sets the status on that hire alone", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    updateVenueHireStatus("hire-1", "Confirmed");

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: "Confirmed" }));
    expect(builder.eq).toHaveBeenCalledWith("id", "hire-1");
  });
});

describe("setBookingHire", () => {
  it("attaches a standalone booking to a hire", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setBookingHire("booking-1", "hire-1");

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ hire_id: "hire-1" }));
    expect(builder.eq).toHaveBeenCalledWith("id", "booking-1");
  });

  it("releases a booking back to standalone with null, not a delete", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setBookingHire("booking-1", null);

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ hire_id: null }));
    expect(builder.delete).not.toHaveBeenCalled();
  });
});
