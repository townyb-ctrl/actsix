import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VenueEnquiryConvertModal from "./VenueEnquiryConvertModal";
import { linkEnquiryToBooking } from "@/features/venues/api/venueEnquiriesApi";
import { upsertVenueHire } from "@/features/venues/api/venueHiresApi";
import { upsertVenueBooking } from "@/features/venues/api/venuesApi";
import type { VenueSpace } from "@/features/venues/lib/venueBookings";
import type { VenueEnquiry } from "@/features/venues/lib/venueEnquiries";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock("@/features/venues/api/venuesApi", () => ({ upsertVenueBooking: vi.fn() }));
vi.mock("@/features/venues/api/venueEnquiriesApi", () => ({ linkEnquiryToBooking: vi.fn() }));
vi.mock("@/features/venues/api/venueHiresApi", () => ({ upsertVenueHire: vi.fn() }));

const space = (id: string, name: string): VenueSpace => ({
  id,
  workspace_id: "workspace-1",
  user_id: "user-1",
  name,
  description: "",
  capacity: null,
  hourly_rate: 0,
  daily_rate: 0,
  color: "",
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
});

const hall = space("space-hall", "Main Hall");
const foyer = space("space-foyer", "Foyer");

const enquiry: VenueEnquiry = {
  id: "enquiry-1",
  workspace_id: "workspace-1",
  user_id: "user-1",
  event_name: "Robertson wedding",
  event_type: "Wedding",
  organisation: "",
  contact_name: "Dana Robertson",
  contact_email: "dana@example.com",
  contact_phone: "0821234567",
  is_for_profit: false,
  is_ticketed: false,
  expected_attendance: 120,
  preferred_start: "2026-09-12T10:00:00.000Z",
  preferred_end: "2026-09-12T16:00:00.000Z",
  alternate_dates: "",
  setup_notes: "",
  space_ids: ["space-foyer"],
  description: "Ceremony and reception",
  av_needs: "",
  catering_plan: "",
  insurance_status: "Unknown",
  heard_about: "",
  status: "In review",
  source: "public",
  vetting_values_aligned: null,
  vetting_has_restricted_content: null,
  vetting_can_deliver: null,
  vetting_damage_risk: "",
  vetting_reputational_risk: "",
  vetting_notes: "",
  decline_reason: "",
  converted_booking_id: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

const renderModal = () =>
  render(
    <VenueEnquiryConvertModal
      open
      enquiry={enquiry}
      spaces={[hall, foyer]}
      bookings={[]}
      workspaceId="workspace-1"
      userId="user-1"
      onOpenChange={() => {}}
      onSaved={() => {}}
    />
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(upsertVenueBooking).mockResolvedValue({
    data: { id: "booking-1" },
    error: null,
  } as never);
  vi.mocked(linkEnquiryToBooking).mockResolvedValue({ error: null } as never);
  vi.mocked(upsertVenueHire).mockResolvedValue({ data: { id: "hire-1" }, error: null } as never);
});

describe("VenueEnquiryConvertModal", () => {
  it("preselects a space the enquirer actually asked for, not the first one", () => {
    renderModal();

    expect(screen.getByLabelText("Space")).toHaveValue("space-foyer");
  });

  it("creates the hire first, carrying the enquiry it came from", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /create hire/i }));

    await waitFor(() => expect(upsertVenueHire).toHaveBeenCalled());

    expect(vi.mocked(upsertVenueHire).mock.calls[0][0].payload).toEqual(
      expect.objectContaining({
        name: "Robertson wedding",
        event_type: "Wedding",
        status: "Draft",
        enquiry_id: "enquiry-1",
        hirer_name: "Dana Robertson",
      })
    );
  });

  it("attaches the new booking to the hire it just created", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /create hire/i }));

    await waitFor(() => expect(upsertVenueBooking).toHaveBeenCalled());

    expect(vi.mocked(upsertVenueBooking).mock.calls[0][0].payload.hire_id).toBe("hire-1");
  });

  it("creates an external pending booking carrying the hirer's details", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /create hire/i }));

    await waitFor(() => expect(upsertVenueBooking).toHaveBeenCalled());

    expect(vi.mocked(upsertVenueBooking).mock.calls[0][0].payload).toEqual(
      expect.objectContaining({
        space_id: "space-foyer",
        title: "Robertson wedding",
        booking_type: "external",
        status: "Pending",
        hirer_name: "Dana Robertson",
        hirer_email: "dana@example.com",
        hirer_phone: "0821234567",
      })
    );
  });

  it("links the new booking back to the enquiry", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /create hire/i }));

    await waitFor(() =>
      expect(linkEnquiryToBooking).toHaveBeenCalledWith("enquiry-1", "booking-1")
    );
  });

  it("does not create a booking when the times are cleared", async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /create hire/i }));

    await waitFor(() => expect(upsertVenueBooking).not.toHaveBeenCalled());
    expect(linkEnquiryToBooking).not.toHaveBeenCalled();
  });
});
