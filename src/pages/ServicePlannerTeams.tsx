import { Users, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ServicePlannerTeams = () => {
  return (
    <div>
      <div className="px-8 pt-8 pb-12 max-w-7xl space-y-4">
        <div>
          <p className="label-eyebrow">ACTSIX: Service Planning</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            Teams
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Build and manage the people serving in each service: worship, preaching, elders, deacons, AV, and hospitality.
          </p>
        </div>

        <Card className="p-6 border-border/70 bg-card shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-eyebrow">Coming Next</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Service Teams
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This will connect to the future People module, where names, roles, availability, and serving permissions can be managed.
              </p>
            </div>

            <div className="h-10 w-10 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <Button disabled className="actsix-btn-primary rounded-xl mt-5">
            <Plus className="h-4 w-4" />
            Add Team Member
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default ServicePlannerTeams;
