import { FormEvent, useEffect, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckboxField, Field, fieldControlClass } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  setVenueEnquiryStatus,
  upsertVenueReplyTemplate,
} from "@/features/venues/api/venueEnquiriesApi";
import type { VenueReplyTemplate } from "@/features/venues/api/venueEnquiriesQueries";
import type { VenueEnquiry } from "@/features/venues/lib/venueEnquiries";

type Props = {
  open: boolean;
  kind: "Decline" | "More info";
  enquiry: VenueEnquiry;
  templates: VenueReplyTemplate[];
  workspaceId: string;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export default function VenueEnquiryReplyModal({
  open,
  kind,
  enquiry,
  templates,
  workspaceId,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);

  const relevantTemplates = templates.filter((template) => template.kind === kind);

  useEffect(() => {
    if (!open) return;
    setBody(kind === "Decline" ? enquiry.decline_reason : "");
    setTemplateId("");
    setSaveAsTemplate(false);
    setTemplateName("");
  }, [open, kind, enquiry]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = relevantTemplates.find((candidate) => candidate.id === id);
    if (template) setBody(template.body);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (!body.trim()) {
      toast.error(kind === "Decline" ? "Say why you are declining" : "Say what you need to know");
      return;
    }
    if (saveAsTemplate && !templateName.trim()) {
      toast.error("Name the template");
      return;
    }

    setSaving(true);

    const { error } = await setVenueEnquiryStatus({
      enquiryId: enquiry.id,
      status: kind === "Decline" ? "Declined" : "Awaiting info",
      reply: body.trim(),
    });

    if (error) {
      setSaving(false);
      toast.error("Could not update the enquiry", { description: error.message });
      return;
    }

    if (saveAsTemplate) {
      const { error: templateError } = await upsertVenueReplyTemplate({
        workspaceId,
        userId,
        payload: { name: templateName.trim(), kind, body: body.trim() },
      });
      if (templateError) {
        toast.error("Saved the reply, but the template did not save", {
          description: templateError.message,
        });
      }
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={kind === "Decline" ? "Decline Enquiry" : "Request More Info"}
      title={kind === "Decline" ? "Decline this enquiry" : "Ask for more information"}
      description="Saved against the enquiry so everyone can see what was said. Send it to the hirer yourself for now."
      footer={
        <>
          <div />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="venue-enquiry-reply-form"
              disabled={saving}
              className="actsix-btn-primary font-bold"
            >
              <Send className="h-4 w-4" />
              {saving ? "Saving…" : "Save reply"}
            </Button>
          </div>
        </>
      }
    >
      <form id="venue-enquiry-reply-form" className="space-y-5" onSubmit={save}>
        {relevantTemplates.length > 0 && (
          <Field label="Start from a saved reply" htmlFor="venue-enquiry-template">
            <select
              id="venue-enquiry-template"
              value={templateId}
              onChange={(event) => applyTemplate(event.target.value)}
              className={cn(fieldControlClass)}
            >
              <option value="">Write from scratch</option>
              {relevantTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Reply" htmlFor="venue-enquiry-reply">
          <textarea
            id="venue-enquiry-reply"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            className={cn(fieldControlClass, "min-h-32 py-2")}
          />
        </Field>

        <div className="space-y-3 border-t border-border/70 pt-5">
          <CheckboxField
            id="venue-enquiry-save-template"
            label="Save this as a reusable reply"
            checked={saveAsTemplate}
            onCheckedChange={setSaveAsTemplate}
          />

          {saveAsTemplate && (
            <Field label="Template name" htmlFor="venue-enquiry-template-name">
              <input
                id="venue-enquiry-template-name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Ticketed services — decline"
                className={cn(fieldControlClass)}
              />
            </Field>
          )}
        </div>
      </form>
    </FormDialog>
  );
}
