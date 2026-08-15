import { Card } from "@/components/ui/card";

type Props = {
  /** How many placeholder rows to draw. Match the usual page, not the maximum. */
  rows?: number;
};

/**
 * Loading placeholder for the venue list pages.
 *
 * A skeleton in the shape of the real rows, not a line of text: the page keeps
 * its geometry while it loads, so nothing jumps when the data lands and the
 * wait reads as "nearly there" rather than "empty". The shimmer already stops
 * under prefers-reduced-motion via the .st-skeleton rule in index.css.
 */
export default function VenueListSkeleton({ rows = 4 }: Props) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {Array.from({ length: rows }, (_, index) => (
        <Card key={index} className="p-4">
          <span className="st-skeleton block h-3.5 w-2/5" />
          <span className="st-skeleton mt-3 block h-2.5 w-4/5" />
          <span className="st-skeleton mt-3 block h-2.5 w-1/4" />
        </Card>
      ))}
    </div>
  );
}
