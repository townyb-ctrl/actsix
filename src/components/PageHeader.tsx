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
  <div className="px-4 pb-3 pt-4 sm:px-6 md:pt-5 xl:px-8 2xl:px-10">
    <div className="w-full">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          {eyebrow && <div className="label-eyebrow mb-1.5">{eyebrow}</div>}
          <h1 className="text-[1.65rem] font-extrabold leading-tight md:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
      </div>
    </div>
  </div>
);
