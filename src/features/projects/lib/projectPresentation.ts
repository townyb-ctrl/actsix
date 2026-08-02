export const statusClass = (status?: string | null) => {
  const clean = (status || "Active").toLowerCase();

  if (clean.includes("hold")) return "bg-brand-amber/15 text-brand-amber";
  if (clean.includes("planning")) return "bg-brand-teal-soft text-brand-teal";
  if (clean.includes("complete")) return "bg-brand-sage/10 text-brand-sage";

  return "bg-brand-teal/15 text-brand-teal";
};

const projectIconClasses = [
  "bg-brand-teal/10 text-brand-teal",
  "bg-brand-sage-soft text-brand-sage",
  "bg-brand-teal-soft text-brand-teal",
  "bg-brand-amber/10 text-brand-amber",
  "bg-brand-sage/10 text-brand-sage",
  "bg-brand-bronze/10 text-brand-bronze",
];

export const projectIconClass = (index: number) =>
  projectIconClasses[index % projectIconClasses.length];

