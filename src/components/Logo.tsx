import logoFullWhite from "@/assets/branding/actsix-logo-white.png";
import logoIconWhite from "@/assets/branding/actsix-icon-white.png";

export const Logo = ({ compact = false }: { compact?: boolean }) => (
  <div
    className={`flex items-center ${
      compact ? "justify-center w-full" : "justify-start"
    }`}
  >
    {compact ? (
      <img
        src={logoIconWhite}
        alt="ACTSIX"
        className="h-7 w-7 object-contain shrink-0"
      />
    ) : (
      <img
        src={logoFullWhite}
        alt="ACTSIX"
        className="h-20 w-auto max-w-[340px] object-contain"
      />
    )}
  </div>
);
