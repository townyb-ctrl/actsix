import { describe, expect, it } from "vitest";

import {
  blockingBookings,
  sortTurnaroundTasks,
  turnaroundProgress,
  walkthroughCoverage,
  type VenueTurnaroundTask,
  type VenueWalkthrough,
} from "./venueTurnaround";
import type { VenueBooking } from "./venueBookings";

const task = (overrides: Partial<VenueTurnaroundTask> & { id: string }): VenueTurnaroundTask => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  space_id: "hall",
  title: "Mop the hall",
  kind: "Cleaning",
  notes: "",
  starts_at: "2026-09-11T18:00:00.000Z",
  ends_at: "2026-09-11T19:00:00.000Z",
  done: false,
  done_at: null,
  done_by: "",
  sort_order: 0,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const booking = (overrides: Partial<VenueBooking> & { id: string }): VenueBooking => ({
  workspace_id: "workspace-1",
  user_id: "user-1",
  space_id: "hall",
  hire_id: "hire-1",
  title: "Conference",
  booking_type: "external",
  hirer_contact_id: null,
  hirer_name: "",
  hirer_email: "",
  hirer_phone: "",
  starts_at: "2026-09-11T09:00:00.000Z",
  ends_at: "2026-09-11T18:00:00.000Z",
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

const walkthrough = (
  overrides: Partial<VenueWalkthrough> & { id: string }
): VenueWalkthrough => ({
  workspace_id: "workspace-1",
  hire_id: "hire-1",
  user_id: "user-1",
  space_id: "hall",
  phase: "Before",
  condition_notes: "",
  photo_urls: [],
  walked_by: "",
  walked_at: "2026-09-11T08:00:00.000Z",
  created_at: "2026-09-11T08:00:00.000Z",
  updated_at: "2026-09-11T08:00:00.000Z",
  ...overrides,
});

describe("turnaroundProgress", () => {
  it("counts what is done", () => {
    const progress = turnaroundProgress([
      task({ id: "t1", done: true }),
      task({ id: "t2" }),
      task({ id: "t3" }),
    ]);

    expect(progress).toEqual({ done: 1, total: 3, allDone: false });
  });

  it("does not call an empty list finished", () => {
    expect(turnaroundProgress([])).toEqual({ done: 0, total: 0, allDone: false });
  });

  it("is done when every task is", () => {
    expect(turnaroundProgress([task({ id: "t1", done: true })]).allDone).toBe(true);
  });
});

describe("blockingBookings", () => {
  it("flags cleaning booked while the room is still in use", () => {
    const blocked = blockingBookings(
      task({ id: "t1", starts_at: "2026-09-11T17:00:00.000Z", ends_at: "2026-09-11T18:30:00.000Z" }),
      [booking({ id: "b1" })]
    );

    expect(blocked.map((entry) => entry.id)).toEqual(["b1"]);
  });

  it("allows cleaning that starts exactly when the booking ends", () => {
    expect(blockingBookings(task({ id: "t1" }), [booking({ id: "b1" })])).toEqual([]);
  });

  it("ignores a booking in another space", () => {
    const blocked = blockingBookings(
      task({ id: "t1", starts_at: "2026-09-11T17:00:00.000Z", ends_at: "2026-09-11T18:30:00.000Z" }),
      [booking({ id: "b1", space_id: "chapel" })]
    );

    expect(blocked).toEqual([]);
  });

  it("ignores a cancelled booking - nobody is in the room", () => {
    const blocked = blockingBookings(
      task({ id: "t1", starts_at: "2026-09-11T17:00:00.000Z", ends_at: "2026-09-11T18:30:00.000Z" }),
      [booking({ id: "b1", status: "Cancelled" })]
    );

    expect(blocked).toEqual([]);
  });

  it("cannot check an undated task", () => {
    const blocked = blockingBookings(
      task({ id: "t1", starts_at: null, ends_at: null }),
      [booking({ id: "b1" })]
    );

    expect(blocked).toEqual([]);
  });

  it("cannot check a whole-site task, which has no room to be blocked from", () => {
    const blocked = blockingBookings(
      task({
        id: "t1",
        space_id: null,
        starts_at: "2026-09-11T17:00:00.000Z",
        ends_at: "2026-09-11T18:30:00.000Z",
      }),
      [booking({ id: "b1" })]
    );

    expect(blocked).toEqual([]);
  });

  it("stops warning once the task is ticked off", () => {
    const blocked = blockingBookings(
      task({
        id: "t1",
        done: true,
        starts_at: "2026-09-11T17:00:00.000Z",
        ends_at: "2026-09-11T18:30:00.000Z",
      }),
      [booking({ id: "b1" })]
    );

    expect(blocked).toEqual([]);
  });
});

describe("sortTurnaroundTasks", () => {
  it("puts what is left before what is finished", () => {
    const sorted = sortTurnaroundTasks([
      task({ id: "done", done: true, starts_at: "2026-09-11T08:00:00.000Z", ends_at: "2026-09-11T09:00:00.000Z" }),
      task({ id: "open" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["open", "done"]);
  });

  it("orders timed work by when it happens", () => {
    const sorted = sortTurnaroundTasks([
      task({ id: "late", starts_at: "2026-09-11T20:00:00.000Z", ends_at: "2026-09-11T21:00:00.000Z" }),
      task({ id: "early" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["early", "late"]);
  });

  it("puts undated work after timed work rather than at the top", () => {
    const sorted = sortTurnaroundTasks([
      task({ id: "whenever", starts_at: null, ends_at: null }),
      task({ id: "timed" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["timed", "whenever"]);
  });

  it("falls back to the manual order for two undated tasks", () => {
    const sorted = sortTurnaroundTasks([
      task({ id: "second", starts_at: null, ends_at: null, sort_order: 2 }),
      task({ id: "first", starts_at: null, ends_at: null, sort_order: 1 }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["first", "second"]);
  });

  it("does not mutate what it was given", () => {
    const tasks = [task({ id: "b", done: true }), task({ id: "a" })];
    sortTurnaroundTasks(tasks);

    expect(tasks.map((entry) => entry.id)).toEqual(["b", "a"]);
  });
});

describe("walkthroughCoverage", () => {
  it("needs both ends before it counts as evidence", () => {
    expect(walkthroughCoverage([walkthrough({ id: "w1" })]).bothEndsCaptured).toBe(false);
    expect(
      walkthroughCoverage([
        walkthrough({ id: "w1" }),
        walkthrough({ id: "w2", phase: "After" }),
      ]).bothEndsCaptured
    ).toBe(true);
  });

  it("totals the photos across both ends", () => {
    const coverage = walkthroughCoverage([
      walkthrough({ id: "w1", photo_urls: ["a.jpg", "b.jpg"] }),
      walkthrough({ id: "w2", phase: "After", photo_urls: ["c.jpg"] }),
    ]);

    expect(coverage.photoCount).toBe(3);
    expect(coverage.before).toHaveLength(1);
    expect(coverage.after).toHaveLength(1);
  });
});
