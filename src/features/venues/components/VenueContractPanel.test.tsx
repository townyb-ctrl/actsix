import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VenueContractPanel from "./VenueContractPanel";
import type { VenueHire } from "@/features/venues/lib/venueHires";

vi.mock("@/features/venues/api/venuePaymentsApi", () => ({
  setContractClauses: vi.fn().mockResolvedValue({ error: null }),
  setContractSigned: vi.fn().mockResolvedValue({ error: null }),
}));

const hire = (overrides: Partial<VenueHire> = {}): VenueHire =>
  ({
    id: "hire-1",
    contract_clauses: "",
    contract_signed_on: null,
    contract_signed_by: "",
    ...overrides,
  }) as VenueHire;

describe("VenueContractPanel unsaved reporting", () => {
  it("stays quiet until something is actually changed", () => {
    const onUnsavedChange = vi.fn();

    render(
      <VenueContractPanel
        hire={hire()}
        workspaceClauses="No food in the auditorium."
        onPrint={vi.fn()}
        onSaved={vi.fn()}
        onUnsavedChange={onUnsavedChange}
      />
    );

    // Seeded from the standard wording, which nobody typed - not a change.
    expect(onUnsavedChange).toHaveBeenCalledWith("contract", null);
    expect(onUnsavedChange).not.toHaveBeenCalledWith("contract", expect.any(String));
  });

  it("reports typing, and takes it back when the text is put back", () => {
    const onUnsavedChange = vi.fn();

    render(
      <VenueContractPanel
        hire={hire()}
        workspaceClauses="No food in the auditorium."
        onPrint={vi.fn()}
        onSaved={vi.fn()}
        onUnsavedChange={onUnsavedChange}
      />
    );

    const box = screen.getByLabelText(/Terms and conditions for this hire/i);

    fireEvent.change(box, { target: { value: "Upstairs is closed to guests." } });
    expect(onUnsavedChange).toHaveBeenLastCalledWith("contract", "The contract wording");

    fireEvent.change(box, { target: { value: "No food in the auditorium." } });
    expect(onUnsavedChange).toHaveBeenLastCalledWith("contract", null);
  });
});
