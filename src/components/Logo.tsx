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
        className="h-6 w-6 object-contain shrink-0 2xl:h-7 2xl:w-7"
      />
    ) : (
      <img
        src={logoFullWhite}
        alt="ACTSIX"
        className="h-12 w-auto max-w-[220px] object-contain"
      />
    )}
  </div>
);
