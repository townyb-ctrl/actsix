import { describe, expect, it } from "vitest";
import { edgeFunctionError, friendlyErrorMessage } from "./friendlyError";

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

describe("edgeFunctionError", () => {
  const httpError = (body: unknown, status = 500) => ({
    message: "Edge Function returned a non-2xx status code",
    context: new Response(JSON.stringify(body), { status }),
  });

  it("surfaces the message the edge function returned", async () => {
    const unwrapped = await edgeFunctionError(httpError({ error: "Transcription is not configured." }));
    expect(friendlyErrorMessage(unwrapped, "Could not transcribe audio.")).toBe("Transcription is not configured.");
  });

  it("keeps the fallback when the body has no error message", async () => {
    const unwrapped = await edgeFunctionError(httpError({ nope: true }));
    expect(friendlyErrorMessage(unwrapped, "Could not transcribe audio.")).toBe("Could not transcribe audio.");
  });

  it("passes through errors that carry no response context", async () => {
    const error = new Error("boom");
    expect(await edgeFunctionError(error)).toBe(error);
  });
});
