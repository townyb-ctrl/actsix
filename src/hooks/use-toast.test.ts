import { describe, expect, it } from "vitest";

import { reducer } from "./use-toast";

const makeToast = (id: string, overrides: Partial<{ open: boolean; title: string }> = {}) => ({
  id,
  open: true,
  title: `Toast ${id}`,
  ...overrides,
});

describe("toast reducer", () => {
  it("adds a toast to an empty state", () => {
    const state = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: makeToast("1") });
    expect(state.toasts.map((t) => t.id)).toEqual(["1"]);
  });

  it("caps the toast list at the configured limit, keeping the newest first", () => {
    const withOne = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: makeToast("1") });
    const withTwo = reducer(withOne, { type: "ADD_TOAST", toast: makeToast("2") });

    // TOAST_LIMIT is 1, so adding a second toast should drop the first.
    expect(withTwo.toasts.map((t) => t.id)).toEqual(["2"]);
  });

  it("updates only the matching toast, leaving others untouched", () => {
    const state = { toasts: [makeToast("1"), makeToast("2")] };
    const result = reducer(state, { type: "UPDATE_TOAST", toast: { id: "1", title: "Updated" } });

    expect(result.toasts.find((t) => t.id === "1")?.title).toBe("Updated");
    expect(result.toasts.find((t) => t.id === "2")?.title).toBe("Toast 2");
  });

  it("marks a specific toast as closed on dismiss, leaving others open", () => {
    const state = { toasts: [makeToast("1"), makeToast("2")] };
    const result = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });

    expect(result.toasts.find((t) => t.id === "1")?.open).toBe(false);
    expect(result.toasts.find((t) => t.id === "2")?.open).toBe(true);
  });

  it("marks every toast as closed when no toastId is given", () => {
    const state = { toasts: [makeToast("1"), makeToast("2")] };
    const result = reducer(state, { type: "DISMISS_TOAST", toastId: undefined });

    expect(result.toasts.every((t) => t.open === false)).toBe(true);
  });

  it("removes a specific toast on REMOVE_TOAST", () => {
    const state = { toasts: [makeToast("1"), makeToast("2")] };
    const result = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });

    expect(result.toasts.map((t) => t.id)).toEqual(["2"]);
  });

  it("clears every toast when REMOVE_TOAST has no toastId", () => {
    const state = { toasts: [makeToast("1"), makeToast("2")] };
    const result = reducer(state, { type: "REMOVE_TOAST", toastId: undefined });

    expect(result.toasts).toEqual([]);
  });
});
