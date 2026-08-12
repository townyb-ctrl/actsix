import logoFullWhite from "@/assets/branding/actsix-logo-white.png";
import logoIconWhite from "@/assets/branding/actsix-icon-white.png";
import logoIconBlack from "@/assets/branding/actsix-icon-black.png";

type LogoTone = "onLight" | "onDark";

/**
 * The brand assets are monochrome white. Studio's surfaces are light, so the
 * default tone inverts the full lockup to ink — this preserves the exact
 * letterforms, which re-typesetting the wordmark would not.
 *
 * `invert` alone lands on pure black; the opacity step brings it to roughly
 * Studio's ink (#1A1A16). Replacing this with a proper ink-on-transparent
 * export is the real fix — see the note in DESIGN.md.
 */
export const Logo = ({
  compact = false,
  tone = "onLight",
}: {
  compact?: boolean;
  tone?: LogoTone;
}) => {
  const onDark = tone === "onDark";

  return (
    <div
      className={`flex items-center ${compact ? "w-full justify-center" : "justify-start"}`}
    >
      {compact ? (
        <img
          src={onDark ? logoIconWhite : logoIconBlack}
          alt="ACTSIX"
          className="h-6 w-6 shrink-0 object-contain 2xl:h-7 2xl:w-7"
        />
      ) : (
        <img
          src={logoFullWhite}
          alt="ACTSIX"
          className={`h-12 w-auto max-w-[220px] object-contain ${
            onDark ? "" : "opacity-90 invert"
          }`}
        />
      )}
    </div>
  );
};
