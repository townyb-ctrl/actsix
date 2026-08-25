import { ChevronDown, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PrintTarget = "quote" | "run-sheet" | "contract" | "signs";

type Props = {
  onPrint: (target: PrintTarget) => void;
  hasQuote: boolean;
  hasRunSheet: boolean;
  hasSigns: boolean;
};

/**
 * The four things this hire prints, behind one header button.
 *
 * They used to sit one apiece inside four different panels across three
 * different tabs, so "print the run sheet and the signs" was two tab switches
 * and two hunts. Gathering them fixed that but overcorrected: four buttons laid
 * out in a full-width panel of their own spent a whole band of the page, and
 * most of that band was blank paper, on an errand nobody arrives to do. A menu
 * keeps the four together and gives the band back to the work.
 *
 * A document with nothing in it stays disabled rather than hidden: an absent
 * item reads as a missing feature, a disabled one reads as "not yet".
 */
export default function VenueHireDocuments({
  onPrint,
  hasQuote,
  hasRunSheet,
  hasSigns,
}: Props) {
  const documents: { label: string; target: PrintTarget; ready: boolean }[] = [
    { label: "Quote", target: "quote", ready: hasQuote },
    { label: "Agreement", target: "contract", ready: true },
    { label: "Run sheet", target: "run-sheet", ready: hasRunSheet },
    { label: "Signs", target: "signs", ready: hasSigns },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-h-10">
          <Printer className="h-4 w-4" />
          Print
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {documents.map((document) => (
          <DropdownMenuItem
            key={document.target}
            disabled={!document.ready}
            onSelect={() => onPrint(document.target)}
          >
            {document.label}
            {!document.ready && (
              <span className="ml-auto text-xs text-muted-foreground">empty</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
