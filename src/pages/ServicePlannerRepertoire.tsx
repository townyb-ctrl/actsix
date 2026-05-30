import { Music, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ServicePlannerRepertoire = () => {
  return (
    <div>
      <div className="w-full space-y-4 px-4 pb-12 pt-8 sm:px-6 xl:px-8 2xl:px-10">
        <div>
          <p className="label-eyebrow">Service Planner</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            Repertoire
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Manage songs, keys, arrangements, Scripture links, and service-ready worship resources.
          </p>
        </div>

        <Card className="p-6 border-border/70 bg-card shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-eyebrow">Coming Next</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Song Repertoire
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This will store songs that can be added into an order of service, including default keys, themes, tempo, and notes.
              </p>
            </div>

            <div className="h-10 w-10 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <Music className="h-5 w-5" />
            </div>
          </div>

          <Button disabled className="actsix-btn-primary rounded-xl mt-5">
            <Plus className="h-4 w-4" />
            Add Song
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default ServicePlannerRepertoire;
