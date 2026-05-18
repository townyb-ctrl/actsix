export const normalizePhoneForStorage = (value?: string | null) => {
  const raw = value?.trim();

  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");

  if (!digits) return null;

  // South Africa default:
  // 0737754927 -> +27737754927
  if (/^0\d{9}$/.test(digits)) {
    return `+27${digits.slice(1)}`;
  }

  // 737754927 -> +27737754927
  if (/^\d{9}$/.test(digits)) {
    return `+27${digits}`;
  }

  // 27737754927 -> +27737754927
  if (/^27\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  // International E.164-ish fallback
  if (raw.startsWith("+") && /^\+\d{8,15}$/.test(raw.replace(/\s/g, ""))) {
    return raw.replace(/\s/g, "");
  }

  return raw;
};

export const normalizePhoneForWhatsapp = (value?: string | null) => {
  return normalizePhoneForStorage(value)?.replace(/[^\d+]/g, "") || "";
};

export const isMessageablePhone = (value?: string | null) => {
  const normalized = normalizePhoneForStorage(value);

  if (!normalized) return false;

  return /^\+[1-9]\d{7,14}$/.test(normalized);
};

export const getWhatsappHref = (value?: string | null) => {
  const normalized = normalizePhoneForStorage(value);

  if (!normalized || !isMessageablePhone(normalized)) return "";

  return `https://wa.me/${normalized.replace("+", "")}`;
};

export const formatPhoneForDisplay = (value?: string | null) => {
  const normalized = normalizePhoneForStorage(value);

  if (!normalized) return "";

  // South African display format:
  // +27737754927 -> 073 775 4927
  const southAfricanMatch = normalized.match(/^\+27(\d{2})(\d{3})(\d{4})$/);

  if (southAfricanMatch) {
    return `0${southAfricanMatch[1]} ${southAfricanMatch[2]} ${southAfricanMatch[3]}`;
  }

  return normalized;
};
