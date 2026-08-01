import { describe, expect, it } from "vitest";

import {
  formatPhoneForDisplay,
  getWhatsappHref,
  isMessageablePhone,
  normalizePhoneForStorage,
  normalizePhoneForWhatsapp,
} from "./phone";

describe("normalizePhoneForStorage", () => {
  it("returns null for empty/whitespace input", () => {
    expect(normalizePhoneForStorage(undefined)).toBeNull();
    expect(normalizePhoneForStorage(null)).toBeNull();
    expect(normalizePhoneForStorage("   ")).toBeNull();
  });

  it("converts a local SA number with leading 0 to +27 form", () => {
    expect(normalizePhoneForStorage("0737754927")).toBe("+27737754927");
  });

  it("converts a 9-digit number without leading 0 to +27 form", () => {
    expect(normalizePhoneForStorage("737754927")).toBe("+27737754927");
  });

  it("converts a bare 27-prefixed number to +27 form", () => {
    expect(normalizePhoneForStorage("27737754927")).toBe("+27737754927");
  });

  it("strips formatting characters before matching", () => {
    expect(normalizePhoneForStorage("073 775 4927")).toBe("+27737754927");
    expect(normalizePhoneForStorage("(073) 775-4927")).toBe("+27737754927");
  });

  it("passes through an already-international E.164 number", () => {
    expect(normalizePhoneForStorage("+14155552671")).toBe("+14155552671");
  });

  it("strips spaces from an international number", () => {
    expect(normalizePhoneForStorage("+1 415 555 2671")).toBe("+14155552671");
  });

  it("returns null when the input has no digits at all", () => {
    expect(normalizePhoneForStorage("not-a-phone")).toBeNull();
  });

  it("falls back to the raw trimmed value when digits exist but no pattern matches", () => {
    expect(normalizePhoneForStorage("12345")).toBe("12345");
  });
});

describe("normalizePhoneForWhatsapp", () => {
  it("returns digits and + only", () => {
    expect(normalizePhoneForWhatsapp("0737754927")).toBe("+27737754927");
  });

  it("returns empty string when normalization fails to null", () => {
    expect(normalizePhoneForWhatsapp(null)).toBe("");
  });
});

describe("isMessageablePhone", () => {
  it("accepts a valid E.164-shaped SA number", () => {
    expect(isMessageablePhone("0737754927")).toBe(true);
  });

  it("rejects short/invalid input", () => {
    expect(isMessageablePhone("123")).toBe(false);
    expect(isMessageablePhone(null)).toBe(false);
  });
});

describe("getWhatsappHref", () => {
  it("builds a wa.me link for a valid number", () => {
    expect(getWhatsappHref("0737754927")).toBe("https://wa.me/27737754927");
  });

  it("returns empty string for an unmessageable number", () => {
    expect(getWhatsappHref("123")).toBe("");
    expect(getWhatsappHref(null)).toBe("");
  });
});

describe("formatPhoneForDisplay", () => {
  it("formats a SA number into local display grouping", () => {
    expect(formatPhoneForDisplay("+27737754927")).toBe("073 775 4927");
    expect(formatPhoneForDisplay("0737754927")).toBe("073 775 4927");
  });

  it("returns the normalized value unchanged for non-SA numbers", () => {
    expect(formatPhoneForDisplay("+14155552671")).toBe("+14155552671");
  });

  it("returns empty string for empty input", () => {
    expect(formatPhoneForDisplay(null)).toBe("");
  });
});
