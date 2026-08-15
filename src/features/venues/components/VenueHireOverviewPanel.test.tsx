import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VenueHireOverviewPanel from "./VenueHireOverviewPanel";
import { formatCurrency, type VenueBooking, type VenueSpace } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import type { VenueQuoteLine } from "@/features/venues/lib/venueQuotes";
import type { VenuePayment } from "@/features/venues/lib/venuePayments";
import type { VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";
import type { VenuePosition, VenuePositionAssignment } from "@/features/venues/lib/venuePositions";
import type { VenueIncident } from "@/features/venues/lib/venueSafety";
import type { VenueTurnaroundTask } from "@/features/venues/lib/venueTurnaround";

const hire = (overrides: Partial<VenueHire> = {}): VenueHire => ({
  id: "hire-1",
  workspace_id: "workspace-1",
  user_id: "user-1",
  name: "Smith Wedding Reception",
  event_type: "Wedding",
  hirer_contact_id: null,
  hirer_name: "Eleanor Smith",
  hirer_email: "eleanor@example.com",
  hirer_phone: "",
  onsite_contact_name: "",
  onsite_contact_phone: "",
  status: "Confirmed",
  quote_status: "Accepted",
  quote_sent_at: null,
  payment_terms: "",
  contract_clauses: "",
  contract_signed_on: null,
  contract_signed_by: "",
  enquiry_id: null,
  lessons_learned: "",
  debrief_notes: "",
  debrief_completed_on: null,
  hirer_rating: null,
  would_host_again: null,
  damage_found: "",
  damage_cost: 0,
  portal_token: null,
  portal_enabled: false,
  security_required: false,
  security_provider: "",
  security_from: null,
  security_to: null,
  car_guards_required: false,
  car_guard_count: 0,
  access_plan: "",
  av_preset_id: null,
  walkie_channels: "",
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const space = (overrides: Partial<VenueSpace> & { id: string }): VenueSpace => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  name: "Main Hall",
  description: "",
  capacity: null,
  hourly_rate: 0,
  daily_rate: 0,
  color: "#0d9488",
  photo_urls: [],
  standing_capacity: null,
  seated_capacity: null,
  floor_plan_url: null,
  hireable_standalone: true,
  setup_minutes: 0,
  packdown_minutes: 0,
  food_allowed: true,
  is_restricted_zone: false,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  hire_id: "hire-1",
  title: "Smith Wedding Reception",
  booking_type: "external",
  hirer_contact_id: null,
  hirer_name: "Eleanor Smith",
  hirer_email: "",
  hirer_phone: "",
  starts_at: "2026-10-14T12:00:00.000Z",
  ends_at: "2026-10-14T21:00:00.000Z",
  status: "Confirmed",
  quoted_fee: 0,
  deposit_amount: 0,
  payment_status: "Unpaid",
  source: "staff",
  requested_features: [],
  needs_technician: false,
  technician_fee: 0,
  coffee_requested: false,
  coffee_fee: 0,
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const line = (overrides: Partial<VenueQuoteLine> & { id: string }): VenueQuoteLine => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  kind: "Venue",
  description: "Main Hall hire",
  quantity: 1,
  unit_price: 1200,
  sort_order: 0,
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const payment = (overrides: Partial<VenuePayment> & { id: string }): VenuePayment => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  kind: "Payment",
  amount: 400,
  paid_on: "2026-09-01",
  method: "EFT",
  reference: "",
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const position = (overrides: Partial<VenuePosition> & { id: string }): VenuePosition => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  role_id: "role-1",
  starts_at: "2026-10-14T12:00:00.000Z",
  ends_at: "2026-10-14T21:00:00.000Z",
  needed: 2,
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const baseProps = {
  hire: hire(),
  bookings: [booking({ id: "booking-1" })],
  spaces: [space({ id: "hall" })],
  lines: [line({ id: "line-1" })],
  payments: [payment({ id: "payment-1" })],
  runSheetItems: [] as VenueRunSheetItem[],
  positions: [position({ id: "position-1" })],
  assignments: [] as VenuePositionAssignment[],
  incidents: [] as VenueIncident[],
  turnaroundTasks: [] as VenueTurnaroundTask[],
};

describe("VenueHireOverviewPanel", () => {
  it("shows what is still outstanding and still unfilled", () => {
    render(<VenueHireOverviewPanel {...baseProps} onSelect={vi.fn()} />);

    // 1200 quoted, 400 received, so 800 is still owed.
    expect(screen.getByText(/outstanding/i)).toBeInTheDocument();
    const outstandingText = screen.getByText(/outstanding/i).textContent;
    expect(outstandingText).toContain(formatCurrency(800));
    // One position needing 2 people with nobody assigned.
    expect(screen.getByText(/2 roles unfilled/i)).toBeInTheDocument();
  });

  it("jumps to the section behind a card", () => {
    const onSelect = vi.fn();
    render(<VenueHireOverviewPanel {...baseProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Money/i }));

    expect(onSelect).toHaveBeenCalledWith("money");
  });

  it("counts a written debrief as recorded, even with no turnaround tasks", () => {
    render(
      <VenueHireOverviewPanel
        {...baseProps}
        hire={hire({ debrief_notes: "Went smoothly, hirer happy." })}
        turnaroundTasks={[]}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/Debrief written/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing recorded yet/i)).not.toBeInTheDocument();
  });

  it("does not call a deposit-only quote settled", () => {
    render(
      <VenueHireOverviewPanel
        {...baseProps}
        lines={[line({ id: "line-1", kind: "Deposit", unit_price: 5000 })]}
        payments={[]}
        onSelect={vi.fn()}
      />
    );

    expect(screen.queryByText(/settled/i)).not.toBeInTheDocument();
  });

  it("does not count a cancelled booking towards the booking total", () => {
    render(
      <VenueHireOverviewPanel
        {...baseProps}
        bookings={[
          booking({ id: "booking-1", status: "Confirmed" }),
          booking({ id: "booking-2", status: "Cancelled" }),
        ]}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/1 booking/i)).toBeInTheDocument();
    expect(screen.queryByText(/2 bookings/i)).not.toBeInTheDocument();
  });
});
