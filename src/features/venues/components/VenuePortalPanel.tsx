import { useState } from "react";
import { Copy, Link2, LinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { disableHirePortal, enableHirePortal } from "@/features/venues/api/venuePortalApi";
import type { VenueHire } from "@/features/venues/lib/venueHires";

type Props = {
  hire: VenueHire;
  onChanged: () => void;
};

export default function VenuePortalPanel({ hire, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

  const url = hire.portal_token
    ? `${window.location.origin}/venue-hire/${hire.portal_token}`
    : "";

  const enable = async () => {
    setBusy(true);
    const { error } = await enableHirePortal(hire.id);
    setBusy(false);

    if (error) {
      toast.error("Could not create the link", { description: error.message });
      return;
    }
    onChanged();
  };

  const disable = async () => {
    setBusy(true);
    const { error } = await disableHirePortal(hire.id);
    setBusy(false);

    if (error) {
      toast.error("Could not turn the link off", { description: error.message });
      return;
    }
    toast.success("Link turned off");
    onChanged();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Hirer link</CardTitle>
          <Badge variant={hire.portal_enabled ? "default" : "secondary"}>
            {hire.portal_enabled ? "On" : "Off"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          A page the hirer can open without an account: their dates, their quote, the terms, and a
          way to accept. Anyone with the link can see it, so send it to the hirer and nobody else.
        </p>

        {hire.portal_enabled && url ? (
          <>
            <p className="break-all rounded-[var(--radius-control)] border border-border/70 bg-muted/30 p-2 text-xs">
              {url}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copy}>
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              <Button size="sm" variant="ghost" onClick={disable} disabled={busy}>
                Turn off
              </Button>
            </div>
            {hire.quote_status !== "Sent" && (
              <p className="text-xs text-muted-foreground">
                The hirer can only accept once the quote is marked Sent.
              </p>
            )}
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={enable} disabled={busy}>
            {hire.portal_token ? <Link2 className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            {busy ? "Working…" : hire.portal_token ? "Turn the link back on" : "Create a link"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
