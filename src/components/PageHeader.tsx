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
  <div className="px-4 pb-3 pt-5 sm:px-6 xl:px-8 2xl:px-10">
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="label-eyebrow mb-1.5">{eyebrow}</div>}
          <h1 className="text-2xl font-extrabold leading-tight md:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  </div>
);
