import { Users } from "lucide-react";

type PersonAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "rounded";
  className?: string;
};

const sizeClasses = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-20 w-20 text-lg",
};

const iconSizeClasses = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-8 w-8",
};

const shapeClasses = {
  circle: "rounded-full",
  rounded: "rounded-xl",
};

const getInitials = (name?: string | null) => {
  if (!name) return "";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

export function PersonAvatar({
  name,
  avatarUrl,
  size = "md",
  shape = "circle",
  className = "",
}: PersonAvatarProps) {
  const initials = getInitials(name);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Person"}
        className={`${sizeClasses[size]} ${shapeClasses[shape]} shrink-0 object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClasses[size]} ${shapeClasses[shape]} flex shrink-0 items-center justify-center bg-brand-teal/10 font-extrabold text-brand-teal ${className}`}
      title={name || "Person"}
    >
      {initials || <Users className={iconSizeClasses[size]} />}
    </span>
  );
}
