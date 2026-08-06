import { describe, expect, it } from "vitest";
import { friendlyErrorMessage } from "./friendlyError";

describe("friendlyErrorMessage", () => {
  it("maps a duplicate-key error to plain language", () => {
    expect(friendlyErrorMessage({ message: "duplicate key value violates unique constraint" })).toBe(
      "That name is already in use. Try a different one."
    );
  });

  it("maps a permission error to plain language", () => {
    expect(friendlyErrorMessage({ message: "new row violates row-level security policy" })).toBe(
      "You don't have permission to do that."
    );
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(friendlyErrorMessage({ message: "23505: some obscure Postgres code" })).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("handles a missing error gracefully", () => {
    expect(friendlyErrorMessage(null)).toBe("Something went wrong. Please try again.");
  });
});
