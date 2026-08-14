import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { getQuoteLines, setQuoteStatus, upsertQuoteLine } from "./venueQuotesApi";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getQuoteLines", () => {
  it("reads one hire's lines in their hand-set order", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getQuoteLines("hire-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_quote_lines");
    expect(builder.eq).toHaveBeenCalledWith("hire_id", "hire-1");
    expect(builder.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });
});

describe("upsertQuoteLine", () => {
  it("attaches a new line to its hire and workspace", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertQuoteLine({
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { kind: "Venue", description: "Auditorium", quantity: 2, unit_price: 4500 },
    });

    expect(builder.insert).toHaveBeenCalledWith({
      kind: "Venue",
      description: "Auditorium",
      quantity: 2,
      unit_price: 4500,
      workspace_id: "workspace-1",
      hire_id: "hire-1",
      user_id: "user-1",
    });
  });

  it("updates a line without reassigning it to another hire", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertQuoteLine({
      lineId: "line-1",
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { unit_price: 5000 },
    });

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(expect.objectContaining({ unit_price: 5000 }));
    expect(update).not.toHaveProperty("hire_id");
    expect(builder.eq).toHaveBeenCalledWith("id", "line-1");
  });
});

describe("setQuoteStatus", () => {
  it("stamps when a quote was sent", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setQuoteStatus("hire-1", "Sent");

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(expect.objectContaining({ quote_status: "Sent" }));
    expect(update.quote_sent_at).toEqual(expect.any(String));
  });

  it("leaves the sent stamp alone for any other status", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setQuoteStatus("hire-1", "Accepted");

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(expect.objectContaining({ quote_status: "Accepted" }));
    expect(update).not.toHaveProperty("quote_sent_at");
  });
});
