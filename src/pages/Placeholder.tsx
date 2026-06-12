import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Placeholder = ({ title, subtitle, eyebrow }: { title: string; subtitle: string; eyebrow: string }) => (
  <div>
    <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
    <div className="w-full px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
      <Card className="actsix-panel-soft p-5 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
          <Construction className="h-5 w-5" />
        </div>
        <div className="text-lg font-extrabold tracking-tight">Coming soon</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          This view is on the roadmap. The data model is already in place and ready to be wired up.
        </p>
      </Card>
    </div>
  </div>
);

export const Recurring = () => <Placeholder eyebrow="Workflow" title="Recurring" subtitle="Weekly rhythms and repeating responsibilities." />;
export const Review = () => <Placeholder eyebrow="Workflow" title="Review" subtitle="Your weekly sweep - clear, reflect, plan." />;
export const Calendar = () => <Placeholder eyebrow="Workflow" title="Calendar" subtitle="Time-based view of due actions and meetings." />;
export const Meetups = () => <Placeholder eyebrow="Workflow" title="Meetups" subtitle="People, conversations, and shared agendas." />;
