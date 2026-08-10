import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import VenueBookingModal from "./VenueBookingModal";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock("@/features/venues/api/venuesApi", () => ({
  createHirerContact: vi.fn(),
  deleteVenueBooking: vi.fn(),
  upsertVenueBooking: vi.fn(),
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
  features: [],
  photo_urls: [],
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("VenueBookingModal save validation", () => {
  it("toasts instead of throwing when the start time has been cleared", () => {
    render(
      <VenueBookingModal
        open
        booking={null}
        spaces={[space]}
        bookings={[]}
        workspaceId="workspace-1"
        userId="user-1"
        onOpenChange={() => {}}
        onSaved={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Youth night" } });
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "" } });

    expect(() => fireEvent.click(screen.getByRole("button", { name: /save booking/i }))).not.toThrow();
    expect(vi.mocked(toast).error).toHaveBeenCalledWith("Set both a start and end time");
  });
});
