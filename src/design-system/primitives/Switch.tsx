"use client";

import { cn } from "../utils/cn";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
};

const SIZES = {
  sm: { track: "h-5 w-9", thumb: "size-4", on: "translate-x-4" },
  md: { track: "h-6 w-11", thumb: "size-5", on: "translate-x-5" },
} as const;
// The 2px transparent border is the thumb's gap. items-center handles the
// vertical axis; on-travel = trackWidth − 2·border − thumbWidth (md/sm = 20/16px).

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  size = "md",
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  className,
}: SwitchProps) {
  const s = SIZES[size];
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
        "transition-colors duration-[var(--duration)] ease-[var(--ease-out)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[var(--accent)]" : "bg-[var(--border-elevated)]",
        s.track,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm",
          "transition-transform duration-[var(--duration)] ease-[var(--ease-out)] motion-reduce:transition-none",
          s.thumb,
          checked ? s.on : "translate-x-0",
        )}
      />
    </button>
  );
}
