import Image from "next/image";
import { cn } from "../utils/cn";

const ICON_SRC = {
  sm: "/favicon-32x32.png",
  md: "/apple-touch-icon.png",
  lg: "/android-chrome-192x192.png",
} as const;

const ICON_PX = {
  sm: 24,
  md: 32,
  lg: 64,
} as const;

type KasieLogoProps = {
  size?: keyof typeof ICON_PX;
  showWordmark?: boolean;
  className?: string;
  imageClassName?: string;
};

export function KasieLogo({
  size = "md",
  showWordmark = false,
  className,
  imageClassName,
}: KasieLogoProps) {
  const px = ICON_PX[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src={ICON_SRC[size]}
        alt=""
        width={px}
        height={px}
        className={cn("shrink-0 rounded-lg", imageClassName)}
        priority={size !== "lg"}
      />
      {showWordmark ? (
        <span className="text-lg font-semibold tracking-tight">Kasie</span>
      ) : null}
    </span>
  );
}
