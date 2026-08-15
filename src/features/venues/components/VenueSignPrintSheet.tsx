import { createPortal } from "react-dom";

import type { SignPlanEntry } from "@/features/venues/lib/venueSignage";

type Props = {
  workspaceName: string;
  hireName: string;
  entries: SignPlanEntry[];
};

/**
 * The signs themselves, one per page.
 *
 * Same portal-onto-body approach as the other print sheets, because printing
 * hides `#root` wholesale. Only signs that need printing are included: a sign
 * already sitting in the cupboard does not need a fresh copy, and printing one
 * anyway is how a store room fills with duplicates.
 *
 * Each sign repeats for its quantity, so a run of three is three pages rather
 * than one page somebody has to remember to print three times.
 */
export default function VenueSignPrintSheet({ workspaceName, hireName, entries }: Props) {
  const pages = entries
    .filter((entry) => entry.needsPrinting)
    .flatMap((entry) =>
      Array.from({ length: entry.link.quantity }, (_, index) => ({
        key: `${entry.link.id}-${index}`,
        entry,
      }))
    );

  return createPortal(
    <div className="actsix-print-sheet" aria-hidden>
      {pages.length === 0 ? (
        <article>
          <p>Every sign for {hireName} is already printed.</p>
        </article>
      ) : (
        pages.map(({ key, entry }) => (
          <article
            key={key}
            style={{
              pageBreakAfter: "always",
              minHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              gap: "1.5rem",
            }}
          >
            <h1 style={{ fontSize: "3rem", lineHeight: 1.1, margin: 0 }}>{entry.sign.name}</h1>

            {entry.sign.body && (
              <p style={{ fontSize: "1.75rem", margin: 0, whiteSpace: "pre-wrap" }}>
                {entry.sign.body}
              </p>
            )}

            <footer style={{ fontSize: "0.75rem", opacity: 0.6 }}>
              {workspaceName} · {hireName}
              {entry.placement && ` · ${entry.placement}`}
            </footer>
          </article>
        ))
      )}
    </div>,
    document.body
  );
}
