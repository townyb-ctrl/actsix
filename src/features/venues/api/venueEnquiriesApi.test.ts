import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  getVenueEnquiries,
  linkEnquiryToBooking,
  setVenueEnquiryStatus,
  updateVenueEnquiryVetting,
  upsertVenueEnquiry,
} from "./venueEnquiriesApi";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getVenueEnquiries", () => {
  it("filters to the workspace, newest first", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getVenueEnquiries("workspace-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_enquiries");
    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("falls back to an impossible workspace rather than reading every row", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getVenueEnquiries(undefined);

    expect(builder.eq).toHaveBeenCalledWith("workspace_id", "00000000-0000-0000-0000-000000000000");
  });
});

describe("upsertVenueEnquiry", () => {
  it("marks a staff-raised enquiry as such on insert", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueEnquiry({
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { event_name: "Funeral", contact_name: "Sam", contact_email: "sam@example.com" },
    });

    expect(builder.insert).toHaveBeenCalledWith({
      event_name: "Funeral",
      contact_name: "Sam",
      contact_email: "sam@example.com",
      workspace_id: "workspace-1",
      user_id: "user-1",
      source: "staff",
    });
  });

  it("updates an existing enquiry without rewriting its workspace or source", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertVenueEnquiry({
      enquiryId: "enquiry-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      payload: { event_name: "Renamed" },
    });

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(expect.objectContaining({ event_name: "Renamed" }));
    expect(update).not.toHaveProperty("source");
    expect(update).not.toHaveProperty("workspace_id");
    expect(builder.eq).toHaveBeenCalledWith("id", "enquiry-1");
    expect(builder.insert).not.toHaveBeenCalled();
  });
});

describe("updateVenueEnquiryVetting", () => {
  it("writes a considered no rather than dropping it as falsy", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    updateVenueEnquiryVetting("enquiry-1", {
      vetting_values_aligned: false,
      vetting_damage_risk: "High",
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ vetting_values_aligned: false, vetting_damage_risk: "High" })
    );
  });
});

describe("setVenueEnquiryStatus", () => {
  it("stores the reply alongside the status when one is given", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setVenueEnquiryStatus({
      enquiryId: "enquiry-1",
      status: "Declined",
      reply: "We do not hire out for ticketed services.",
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "Declined",
        decline_reason: "We do not hire out for ticketed services.",
      })
    );
  });

  it("leaves an existing reply untouched when none is given", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setVenueEnquiryStatus({ enquiryId: "enquiry-1", status: "In review" });

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(expect.objectContaining({ status: "In review" }));
    expect(update).not.toHaveProperty("decline_reason");
  });
});

describe("linkEnquiryToBooking", () => {
  it("accepts the enquiry and records the booking it became", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    linkEnquiryToBooking("enquiry-1", "booking-1");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Accepted", converted_booking_id: "booking-1" })
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "enquiry-1");
  });
});
