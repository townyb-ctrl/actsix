import { ReactNode } from "react";

export const PageHeader = ({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) => (
  <div className="px-8 pt-10 pb-6">
    <div className="max-w-7xl">
      {eyebrow && <div className="label-eyebrow mb-3">{eyebrow}</div>}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-balance leading-[0.95]">
            {title}
          </h1>
          {subtitle && <p className="mt-3 text-muted-foreground max-w-2xl">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  </div>
);
