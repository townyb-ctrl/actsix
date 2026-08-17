import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VenueHireEditorModal from "./VenueHireEditorModal";
import type { VenueHire } from "@/features/venues/lib/venueHires";

const upsertVenueHire = vi.fn().mockResolvedValue({ data: { id: "hire-1" }, error: null });

vi.mock("@/features/venues/api/venueHiresApi", () => ({
  upsertVenueHire: (...args: unknown[]) => upsertVenueHire(...args),
}));

const hire = (overrides: Partial<VenueHire> = {}): VenueHire =>
  ({
    id: "hire-1",
    name: "SA National Amateur Bodybuilding Championships",
    event_type: "Competition",
    status: "Draft",
    hirer_name: "IFBB",
    hirer_email: "",
    hirer_phone: "",
    onsite_contact_name: "",
    onsite_contact_phone: "",
    payment_terms: "",
    lessons_learned: "",
    notes: "Chased them twice for the deposit last year.",
    hirer_notes: "Load in through the side door.",
    ...overrides,
  }) as VenueHire;

const renderModal = (props: Partial<React.ComponentProps<typeof VenueHireEditorModal>> = {}) =>
  render(
    <VenueHireEditorModal
      open
      hire={hire()}
      workspaceId="workspace-1"
      userId="user-1"
      onOpenChange={vi.fn()}
      onSaved={vi.fn()}
      {...props}
    />
  );

describe("VenueHireEditorModal review step", () => {
  it("reads a new hire back before creating it", async () => {
    upsertVenueHire.mockClear();
    renderModal({ hire: null });

    fireEvent.change(screen.getByLabelText(/^Name/i), {
      target: { value: "Grade 7 Farewell" },
    });
    fireEvent.change(screen.getByLabelText(/Notes for the hirer/i), {
      target: { value: "Side door from 06:00." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Review/i }));

    // Nothing is written until the read-back is accepted.
    expect(upsertVenueHire).not.toHaveBeenCalled();
    expect(screen.getByText(/Before this hire exists/i)).toBeInTheDocument();
    expect(screen.getByText("Grade 7 Farewell")).toBeInTheDocument();
    expect(screen.getByText(/Nobody to call yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is booked yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create the hire/i }));
    await waitFor(() => expect(upsertVenueHire).toHaveBeenCalled());
  });

  it("lets you go back and change something", () => {
    renderModal({ hire: null });

    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: "Grade 7 Farewell" } });
    fireEvent.click(screen.getByRole("button", { name: /Review/i }));
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));

    expect((screen.getByLabelText(/^Name/i) as HTMLInputElement).value).toBe("Grade 7 Farewell");
  });

  it("saves an existing hire outright, with no review in the way", async () => {
    upsertVenueHire.mockClear();
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Save hire/i }));

    await waitFor(() => expect(upsertVenueHire).toHaveBeenCalled());
    expect(screen.queryByText(/Before this hire exists/i)).not.toBeInTheDocument();
  });
});

describe("VenueHireEditorModal notes", () => {
  it("keeps the two notes in separate fields, each saying who reads it", () => {
    renderModal();

    const forHirer = screen.getByLabelText(/Notes for the hirer/i) as HTMLTextAreaElement;
    const internal = screen.getByLabelText(/Internal notes/i) as HTMLTextAreaElement;

    expect(forHirer.value).toBe("Load in through the side door.");
    expect(internal.value).toBe("Chased them twice for the deposit last year.");

    expect(screen.getByText("They see this")).toBeInTheDocument();
    expect(screen.getByText("Staff only")).toBeInTheDocument();
  });

  it("saves each note to its own column, so neither can land in the other", async () => {
    upsertVenueHire.mockClear();
    renderModal();

    fireEvent.change(screen.getByLabelText(/Notes for the hirer/i), {
      target: { value: "Pieter has the keys from 06:00." },
    });
    fireEvent.change(screen.getByLabelText(/Internal notes/i), {
      target: { value: "Take the bond up front this time." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(upsertVenueHire).toHaveBeenCalled());

    const { payload } = upsertVenueHire.mock.calls[0][0];
    expect(payload.hirer_notes).toBe("Pieter has the keys from 06:00.");
    expect(payload.notes).toBe("Take the bond up front this time.");
  });
});
