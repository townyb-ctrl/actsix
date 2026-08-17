/**
 * Space colours are identity, not status: they say which room a booking is in,
 * never whether something is wrong. So they sit under the accent rather than
 * competing with it, and none of them is teal's "act here".
 *
 * These are literal hex because a space's colour is stored on the row, not read
 * from CSS at render time. They mirror `--st-space-*` in index.css; change both
 * together. Every value clears 4.5:1 against white, because the calendar chip
 * paints white 10px type on top of it.
 */
export const SPACE_COLORS = [
  { value: "#2c7169", label: "Teal" },
  { value: "#55613f", label: "Sage" },
  { value: "#8a4a38", label: "Clay" },
  { value: "#3e4a73", label: "Indigo" },
  { value: "#6a3e5c", label: "Plum" },
  { value: "#7a5424", label: "Bronze" },
  { value: "#4a5157", label: "Slate" },
  { value: "#3f6b4f", label: "Moss" },
] as const;

/** Unpainted spaces still have to read clearly. Studio ink-3. */
export const DEFAULT_SPACE_COLOR = "#6e6c63";

/**
 * The stock Tailwind hues spaces were painted with before Studio. They ran
 * 2.9:1 to 3.1:1 under the chip's white type, so they are mapped on read rather
 * than left in place - one for one, so two rooms never collapse into one
 * colour. Hue is approximate where the old palette had no Studio neighbour.
 */
const LEGACY_SPACE_COLORS: Record<string, string> = {
  "#0d9488": "#2c7169",
  "#d97706": "#7a5424",
  "#0284c7": "#3e4a73",
  "#e11d48": "#8a4a38",
  "#7c3aed": "#6a3e5c",
  "#059669": "#3f6b4f",
  "#ea580c": "#55613f",
  "#475569": "#4a5157",
};

/** The colour to paint a space in, legacy values translated. */
export const spaceColor = (color?: string | null) => {
  if (!color) return DEFAULT_SPACE_COLOR;
  return LEGACY_SPACE_COLORS[color.toLowerCase()] ?? color;
};
