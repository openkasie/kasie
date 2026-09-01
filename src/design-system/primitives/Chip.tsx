import type { HTMLAttributes, ReactNode } from "react";
import { chipVariants, type ChipVariant } from "../utils/variants";
import { cn } from "../utils/cn";

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: ChipVariant;
  size?: "sm" | "md";
  dot?: boolean;
};

const DOT_COLOR: Record<ChipVariant, string> = {
  default: "bg-[var(--fg-subtle)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning-fg)]",
  danger: "bg-[var(--danger)]",
  info: "bg-[var(--info-fg)]",
};

export function Chip({
  variant = "default",
  size = "sm",
  dot = false,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        chipVariants[variant],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", DOT_COLOR[variant])} aria-hidden />
      ) : null}
      {children as ReactNode}
    </span>
  );
}
