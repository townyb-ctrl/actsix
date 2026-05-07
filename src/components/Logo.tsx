import logo from "@/assets/actsix-logo.png";

export const Logo = ({ compact = false }: { compact?: boolean }) => (
  <div className="flex items-center gap-2.5">
    {compact ? (
      <img src={logo} alt="ACTSIX" className="h-12 w-12 object-contain shrink-0" />
    ) : (
      <img src={logo} alt="ACTSIX" className="h-16 w-auto object-contain" />
    )}
  </div>
);
