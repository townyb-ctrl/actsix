import * as React from "react";

import { cn } from "@/lib/utils";

export const fieldControlClass =
  "h-8 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/15 focus-visible:ring-offset-0 sm:text-xs";

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({ label, htmlFor, hint, children, className }: FieldProps) {
  // Only meaningful when both an id to point at and a hint to describe exist.
  const hintId = htmlFor && hint ? `${htmlFor}-hint` : undefined;

  // Auto-wire aria-describedby onto the single control child rather than
  // requiring every call site to pass it manually. Falls back to rendering
  // the hint unassociated if a call site's child isn't a single element or
  // already declares its own aria-describedby.
  const control =
    hintId && React.isValidElement(children) && !(children.props as { "aria-describedby"?: string })["aria-describedby"]
      ? React.cloneElement(children as React.ReactElement<{ "aria-describedby"?: string }>, {
          "aria-describedby": hintId,
        })
      : children;

  return (
    <div className={cn("space-y-1", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="label-eyebrow">
          {label}
        </label>
      ) : (
        <span className="label-eyebrow block">{label}</span>
      )}
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
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
