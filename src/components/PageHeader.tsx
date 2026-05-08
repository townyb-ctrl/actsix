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
  <div className="px-8 pt-6 pb-3">
    <div className="max-w-7xl">
      {eyebrow && <div className="label-eyebrow mb-2">{eyebrow}</div>}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-balance leading-[0.98]">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-muted-foreground max-w-2xl">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  </div>
);
