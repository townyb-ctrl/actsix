import { Music, Plus } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const ServicePlannerRepertoirePage = () => {
  return (
    <div>
      <PageHeader
        eyebrow="Service Planner"
        title="Repertoire"
        subtitle="Manage songs, keys, arrangements, Scripture links, and service-ready worship resources."
      />

      <div className="w-full space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="actsix-panel-soft border-border/60 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-eyebrow">Coming Next</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Song Repertoire
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                This will store songs that can be added into an order of service, including default keys, themes, tempo, and notes.
              </p>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
              <Music className="h-5 w-5" />
            </div>
          </div>

          <Button disabled className="actsix-btn-primary mt-5">
            <Plus className="h-4 w-4" />
            Add Song
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default ServicePlannerRepertoirePage;
