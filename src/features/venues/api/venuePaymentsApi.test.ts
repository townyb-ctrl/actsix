import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryBuilder, okResult } from "@/test/supabaseMock";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  getPayments,
  setContractSigned,
  setWorkspaceContractClauses,
  upsertPayment,
} from "./venuePaymentsApi";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getPayments", () => {
  it("reads one hire's payments, most recent first", () => {
    const builder = createQueryBuilder(okResult([]));
    supabaseMock.from.mockReturnValue(builder);

    getPayments("hire-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("venue_payments");
    expect(builder.eq).toHaveBeenCalledWith("hire_id", "hire-1");
    expect(builder.order).toHaveBeenCalledWith("paid_on", { ascending: false });
  });
});

describe("upsertPayment", () => {
  it("attaches a new payment to its hire and workspace", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertPayment({
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { kind: "Payment", amount: 2000, method: "EFT" },
    });

    expect(builder.insert).toHaveBeenCalledWith({
      kind: "Payment",
      amount: 2000,
      method: "EFT",
      workspace_id: "workspace-1",
      hire_id: "hire-1",
      user_id: "user-1",
    });
  });

  it("stores a refund as a negative amount rather than a separate kind", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertPayment({
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { kind: "Payment", amount: -500 },
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "Payment", amount: -500 })
    );
  });

  it("updates a payment without reassigning it to another hire", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    upsertPayment({
      paymentId: "payment-1",
      workspaceId: "workspace-1",
      hireId: "hire-1",
      userId: "user-1",
      payload: { amount: 2500 },
    });

    const [update] = vi.mocked(builder.update).mock.calls[0];
    expect(update).toEqual(expect.objectContaining({ amount: 2500 }));
    expect(update).not.toHaveProperty("hire_id");
  });
});

describe("setContractSigned", () => {
  it("records who signed and when", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setContractSigned({ hireId: "hire-1", signedOn: "2026-09-01", signedBy: "Dana Robertson" });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        contract_signed_on: "2026-09-01",
        contract_signed_by: "Dana Robertson",
      })
    );
  });

  it("clears the signature with a null date rather than deleting anything", () => {
    const builder = createQueryBuilder(okResult(null));
    supabaseMock.from.mockReturnValue(builder);

    setContractSigned({ hireId: "hire-1", signedOn: null, signedBy: "" });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ contract_signed_on: null })
    );
    expect(builder.delete).not.toHaveBeenCalled();
  });
});

describe("setWorkspaceContractClauses", () => {
  it("returns the row so a write blocked by RLS is distinguishable from success", () => {
    const builder = createQueryBuilder(okResult([{ id: "workspace-1" }]));
    supabaseMock.from.mockReturnValue(builder);

    setWorkspaceContractClauses("workspace-1", "No food in the auditorium.");

    expect(builder.update).toHaveBeenCalledWith({
      venue_contract_clauses: "No food in the auditorium.",
    });
    expect(builder.select).toHaveBeenCalledWith("id");
  });
});
