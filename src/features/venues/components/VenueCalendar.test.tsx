import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VenueCalendar from "./VenueCalendar";
import type { VenueBooking, VenueSpace } from "@/features/venues/lib/venueBookings";

const space = (overrides: Partial<VenueSpace> & { id: string }): VenueSpace => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  name: "Main Hall",
  description: "",
  capacity: null,
  hourly_rate: 0,
  daily_rate: 0,
  color: "#0d9488",
  features: [],
  photo_urls: [],
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  title: "Retreat Weekend",
  booking_type: "internal",
  hirer_contact_id: null,
  hirer_name: "",
  hirer_email: "",
  hirer_phone: "",
  starts_at: "2026-08-10T10:00:00.000Z",
  ends_at: "2026-08-10T12:00:00.000Z",
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

// August 2026 - fixed so the test never drifts with "today".
const visibleMonth = new Date(2026, 7, 1);
const noop = () => {};

describe("VenueCalendar", () => {
  it("paints a booking that starts before the visible month on every in-window day it covers", () => {
    const spanning = booking({
      id: "b1",
      // Starts in July, the month before the one rendered, but runs into August.
      starts_at: new Date(2026, 6, 30, 18, 0, 0).toISOString(),
      ends_at: new Date(2026, 7, 2, 9, 0, 0).toISOString(),
    });

    render(
      <VenueCalendar
        visibleMonth={visibleMonth}
        bookings={[spanning]}
        spaces={[space({ id: "hall" })]}
        loading={false}
        onMonthChange={noop}
        onSelectBooking={noop}
      />
    );

    // Jul 30, Jul 31, Aug 1, Aug 2 - one chip per day the booking covers,
    // including the two days that fall inside the rendered month.
    expect(screen.getAllByRole("button", { name: /Retreat Weekend/ })).toHaveLength(4);
  });

  it("never renders a cancelled booking", () => {
    const cancelled = booking({ id: "b1", status: "Cancelled", starts_at: "2026-08-05T10:00:00.000Z", ends_at: "2026-08-05T12:00:00.000Z" });

    render(
      <VenueCalendar
        visibleMonth={visibleMonth}
        bookings={[cancelled]}
        spaces={[space({ id: "hall" })]}
        loading={false}
        onMonthChange={noop}
        onSelectBooking={noop}
      />
    );

    expect(screen.queryByRole("button", { name: /Retreat Weekend/ })).not.toBeInTheDocument();
  });

  it("calls onSelectBooking with the clicked booking", () => {
    const onSelectBooking = vi.fn();
    const single = booking({ id: "b1", starts_at: "2026-08-05T10:00:00.000Z", ends_at: "2026-08-05T12:00:00.000Z" });

    render(
      <VenueCalendar
        visibleMonth={visibleMonth}
        bookings={[single]}
        spaces={[space({ id: "hall" })]}
        loading={false}
        onMonthChange={noop}
        onSelectBooking={onSelectBooking}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Retreat Weekend/ }));

    expect(onSelectBooking).toHaveBeenCalledTimes(1);
    expect(onSelectBooking).toHaveBeenCalledWith(single);
  });
});
