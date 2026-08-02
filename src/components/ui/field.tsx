import * as React from "react";

import { cn } from "@/lib/utils";

export const fieldControlClass =
  "h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15";

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({ label, htmlFor, hint, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type FieldGroupProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function FieldGroup({ title, children, className }: FieldGroupProps) {
  return (
    <section className={cn("space-y-4 border-t border-border/70 pt-5 first:border-t-0 first:pt-0", className)}>
      <h3 className="label-eyebrow">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

type FieldRowProps = {
  children: React.ReactNode;
  className?: string;
};

export function FieldRow({ children, className }: FieldRowProps) {
  return <div className={cn("grid items-start gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

type CheckboxFieldProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

export function CheckboxField({ id, label, checked, onCheckedChange, className }: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className={cn("flex items-center gap-3 text-sm font-semibold", className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="h-4 w-4 accent-brand-teal"
      />
      {label}
    </label>
  );
}
