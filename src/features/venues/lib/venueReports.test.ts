import { describe, expect, it } from "vitest";

import {
  enquiryFunnel,
  monthsWindow,
  repeatHirers,
  revenueByEventType,
  spaceUtilisation,
  withinReportWindow,
} from "./venueReports";
import { VENUE_ENQUIRY_STATUSES, type VenueEnquiry } from "./venueEnquiries";
import type { VenueBooking, VenueSpace } from "./venueBookings";
import type { VenueHire } from "./venueHires";
import type { VenuePayment } from "./venuePayments";
import type { VenueQuoteLine } from "./venueQuotes";

const enquiry = (overrides: Partial<VenueEnquiry> & { id: string }): VenueEnquiry =>
  ({
    workspace_id: "workspace-1",
    user_id: "user-1",
    event_name: "Conference",
    event_type: "Conference",
    organisation: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    is_for_profit: false,
    is_ticketed: false,
    expected_attendance: null,
    preferred_start: null,
    preferred_end: null,
    alternate_dates: "",
    setup_notes: "",
    space_ids: [],
    description: "",
    av_needs: "",
    catering_plan: "",
    insurance_status: "Unknown",
    heard_about: "",
    status: "New",
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
    ...overrides,
  }) as VenueEnquiry;

const space = (id: string, name: string): VenueSpace =>
  ({ id, name, is_active: true }) as VenueSpace;

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking =>
  ({
    workspace_id: "workspace-1",
    user_id: "user-1",
    space_id: "hall",
    hire_id: null,
    title: "Booking",
    booking_type: "external",
    starts_at: "2026-09-10T09:00:00.000Z",
    ends_at: "2026-09-10T13:00:00.000Z",
    status: "Confirmed",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }) as VenueBooking;

const hire = (overrides: Partial<VenueHire> & { id: string }): VenueHire =>
  ({
    workspace_id: "workspace-1",
    user_id: "user-1",
    name: "Hire",
    event_type: "Conference",
    hirer_contact_id: null,
    hirer_name: "Grace Ministries",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }) as VenueHire;

const line = (overrides: Partial<VenueQuoteLine> & { id: string }): VenueQuoteLine =>
  ({
    workspace_id: "workspace-1",
    hire_id: "hire-1",
    user_id: "user-1",
    kind: "Venue",
    description: "Hall",
    quantity: 1,
    unit_price: 1000,
    sort_order: 0,
    notes: "",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }) as VenueQuoteLine;

const payment = (overrides: Partial<VenuePayment> & { id: string }): VenuePayment =>
  ({
    workspace_id: "workspace-1",
    hire_id: "hire-1",
    user_id: "user-1",
    kind: "Payment",
    amount: 500,
    paid_on: "2026-09-01",
    method: "EFT",
    reference: "",
    notes: "",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  }) as VenuePayment;

describe("enquiryFunnel", () => {
  it("counts every stage, including the empty ones", () => {
    const funnel = enquiryFunnel(
      [enquiry({ id: "e1" }), enquiry({ id: "e2", status: "Accepted" })],
      VENUE_ENQUIRY_STATUSES
    );

    expect(funnel.stages).toHaveLength(VENUE_ENQUIRY_STATUSES.length);
    expect(funnel.stages.find((stage) => stage.status === "Declined")?.count).toBe(0);
    expect(funnel.total).toBe(2);
  });

  it("does not count undecided enquiries against the conversion rate", () => {
    const funnel = enquiryFunnel(
      [
        enquiry({ id: "e1", status: "Accepted" }),
        enquiry({ id: "e2", status: "Declined" }),
        enquiry({ id: "e3", status: "New" }),
        enquiry({ id: "e4", status: "In review" }),
      ],
      VENUE_ENQUIRY_STATUSES
    );

    expect(funnel.conversionRate).toBe(0.5);
  });

  it("reports zero rather than dividing by nothing when nothing is decided", () => {
    const funnel = enquiryFunnel([enquiry({ id: "e1" })], VENUE_ENQUIRY_STATUSES);

    expect(funnel.conversionRate).toBe(0);
  });
});

describe("spaceUtilisation", () => {
  const window = { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" };
  const spaces = [space("hall", "Hall"), space("chapel", "Chapel")];

  it("totals booked hours per space, busiest first", () => {
    const result = spaceUtilisation(
      [
        booking({ id: "b1" }),
        booking({
          id: "b2",
          space_id: "chapel",
          starts_at: "2026-09-11T09:00:00.000Z",
          ends_at: "2026-09-11T10:00:00.000Z",
        }),
      ],
      spaces,
      window
    );

    expect(result[0]).toMatchObject({ spaceId: "hall", hours: 4, bookings: 1 });
    expect(result[1]).toMatchObject({ spaceId: "chapel", hours: 1 });
  });

  it("clips a booking that straddles the window edge instead of counting it whole", () => {
    const result = spaceUtilisation(
      [
        booking({
          id: "b1",
          starts_at: "2026-08-31T22:00:00.000Z",
          ends_at: "2026-09-01T02:00:00.000Z",
        }),
      ],
      spaces,
      window
    );

    expect(result[0].hours).toBe(2);
  });

  it("ignores a booking entirely outside the window", () => {
    const result = spaceUtilisation(
      [
        booking({
          id: "b1",
          starts_at: "2026-07-10T09:00:00.000Z",
          ends_at: "2026-07-10T13:00:00.000Z",
        }),
      ],
      spaces,
      window
    );

    expect(result.every((entry) => entry.hours === 0)).toBe(true);
  });

  it("does not count a cancelled booking", () => {
    const result = spaceUtilisation([booking({ id: "b1", status: "Cancelled" })], spaces, window);

    expect(result[0].hours).toBe(0);
  });

  it("still lists a space nobody booked", () => {
    const result = spaceUtilisation([], spaces, window);

    expect(result).toHaveLength(2);
    expect(result.every((entry) => entry.bookings === 0)).toBe(true);
  });
});

describe("revenueByEventType", () => {
  it("splits quoted from received, so the gap is visible", () => {
    const result = revenueByEventType(
      [hire({ id: "hire-1" })],
      [line({ id: "l1", hire_id: "hire-1" })],
      [payment({ id: "p1", hire_id: "hire-1" })]
    );

    expect(result[0]).toMatchObject({ eventType: "Conference", quoted: 1000, received: 500 });
  });

  it("keeps bond money out of revenue", () => {
    const result = revenueByEventType(
      [hire({ id: "hire-1" })],
      [line({ id: "l1", hire_id: "hire-1" })],
      [
        payment({ id: "p1", hire_id: "hire-1" }),
        payment({ id: "p2", hire_id: "hire-1", kind: "Bond", amount: 2000 }),
      ]
    );

    expect(result[0].received).toBe(500);
  });

  it("adds up hires of the same type", () => {
    const result = revenueByEventType(
      [hire({ id: "hire-1" }), hire({ id: "hire-2" })],
      [line({ id: "l1", hire_id: "hire-1" }), line({ id: "l2", hire_id: "hire-2" })],
      []
    );

    expect(result[0]).toMatchObject({ hires: 2, quoted: 2000 });
  });

  it("gives untyped hires a bucket rather than dropping them", () => {
    const result = revenueByEventType([hire({ id: "hire-1", event_type: "  " })], [], []);

    expect(result[0].eventType).toBe("Not categorised");
  });

  it("never attributes another hire's money", () => {
    const result = revenueByEventType(
      [hire({ id: "hire-1" })],
      [line({ id: "l1", hire_id: "hire-2" })],
      [payment({ id: "p1", hire_id: "hire-2" })]
    );

    expect(result[0]).toMatchObject({ quoted: 0, received: 0 });
  });
});

describe("repeatHirers", () => {
  it("only lists someone who came back", () => {
    const result = repeatHirers([hire({ id: "h1" }), hire({ id: "h2" })]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Grace Ministries", hires: 2 });
  });

  it("leaves a one-off hirer out", () => {
    expect(repeatHirers([hire({ id: "h1" })])).toEqual([]);
  });

  it("treats casing and stray spacing as the same hirer", () => {
    const result = repeatHirers([
      hire({ id: "h1", hirer_name: "Grace Ministries" }),
      hire({ id: "h2", hirer_name: "  grace   ministries " }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].hires).toBe(2);
  });

  it("groups on the contact id when there is one, whatever was typed", () => {
    const result = repeatHirers([
      hire({ id: "h1", hirer_contact_id: "person-1", hirer_name: "Grace Ministries" }),
      hire({ id: "h2", hirer_contact_id: "person-1", hirer_name: "Grace Ministries NPC" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].hires).toBe(2);
  });

  it("shows the most recent spelling of the name", () => {
    const result = repeatHirers([
      hire({ id: "h1", hirer_contact_id: "person-1", hirer_name: "Grace Ministries" }),
      hire({
        id: "h2",
        hirer_contact_id: "person-1",
        hirer_name: "Grace Ministries NPC",
        created_at: "2026-09-01T00:00:00.000Z",
      }),
    ]);

    expect(result[0].name).toBe("Grace Ministries NPC");
  });

  it("skips hires with nobody named", () => {
    expect(repeatHirers([hire({ id: "h1", hirer_name: "" }), hire({ id: "h2", hirer_name: "" })])).toEqual(
      []
    );
  });
});

describe("withinReportWindow", () => {
  it("keeps rows inside the window and drops the rest", () => {
    const rows = withinReportWindow(
      [
        enquiry({ id: "in", created_at: "2026-09-10T00:00:00.000Z" }),
        enquiry({ id: "out", created_at: "2026-07-10T00:00:00.000Z" }),
      ],
      { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" }
    );

    expect(rows.map((row) => row.id)).toEqual(["in"]);
  });

  it("excludes the closing instant, so adjacent windows never double-count", () => {
    const rows = withinReportWindow(
      [enquiry({ id: "edge", created_at: "2026-10-01T00:00:00.000Z" })],
      { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" }
    );

    expect(rows).toEqual([]);
  });
});

describe("monthsWindow", () => {
  it("covers whole months up to the end of the current one", () => {
    const window = monthsWindow(3, new Date(2026, 7, 15));

    expect(new Date(window.from).getMonth()).toBe(5);
    expect(new Date(window.from).getDate()).toBe(1);
    expect(new Date(window.to).getMonth()).toBe(8);
  });

  it("rolls back over a year boundary", () => {
    const window = monthsWindow(3, new Date(2026, 0, 15));

    expect(new Date(window.from).getFullYear()).toBe(2025);
    expect(new Date(window.from).getMonth()).toBe(10);
  });
});
