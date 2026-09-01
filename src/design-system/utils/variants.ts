import { cn } from "./cn";

const glass = {
  subtle: "bg-[var(--surface-subtle)] backdrop-blur-md border border-[var(--border-subtle)]",
  surface: "bg-[var(--surface)] backdrop-blur-xl border border-[var(--border)] shadow-[var(--shadow-glass)]",
  elevated: "bg-[var(--surface-elevated)] backdrop-blur-2xl border border-[var(--border-elevated)] shadow-[var(--shadow-elevated)]",
} as const;

export type GlassElevation = keyof typeof glass;

const buttonVariants = {
  primary: "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]",
  secondary: "bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] hover:border-[var(--border-elevated)] active:bg-[var(--surface)]",
  ghost: "text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)] active:bg-[var(--surface)]",
  danger: "bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)] active:bg-[var(--danger)]",
  contrast: "bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 active:opacity-100",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

const buttonSizes = {
  sm: "h-8 rounded-lg px-3 text-xs gap-1.5",
  md: "h-10 rounded-lg px-4 text-sm",
  lg: "h-12 rounded-xl px-5 text-base",
  icon: "size-10 rounded-full p-0",
  "icon-sm": "size-8 rounded-full p-0",
} as const;

export type ButtonSize = keyof typeof buttonSizes;

export const chipVariants = {
  default: "bg-[var(--surface-subtle)] text-[var(--fg-muted)]",
  success: "bg-[var(--success-bg)] text-[var(--success-fg)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-fg)]",
  danger: "bg-[var(--danger-bg)] text-[var(--danger-fg)]",
  info: "bg-[var(--info-bg)] text-[var(--info-fg)]",
} as const;

export type ChipVariant = keyof typeof chipVariants;

export function glassClass(elevation: GlassElevation = "surface") {
  return glass[elevation];
}

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-medium select-none",
    "transition-[background-color,border-color,color,opacity,transform] duration-[var(--duration-fast)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
    "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
    "motion-reduce:active:scale-100",
    buttonSizes[size],
    buttonVariants[variant],
  );
}

export function channelTileClass(selected: boolean, disabled = false) {
  return cn(
    "flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-colors",
    disabled &&
    "cursor-not-allowed border-[var(--border)] bg-[var(--surface-elevated)] opacity-40",
    !disabled &&
    cn(
      "cursor-pointer",
      selected
        ? "border-[var(--fg)] bg-[var(--surface-subtle)]"
        : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-elevated)]",
    ),
  );
}

export function inputClass(invalid = false) {
  return cn(
    "w-full rounded-lg border bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)]",
    "transition-[border-color,box-shadow] duration-[var(--duration-fast)]",
    "focus:outline-none focus-visible:outline-none focus:ring-2",
    "disabled:cursor-not-allowed disabled:opacity-60",
    invalid
      ? "border-[var(--danger-border)] focus:ring-[var(--danger)]"
      : "border-[var(--border)] hover:border-[var(--border-elevated)] focus:ring-[var(--ring)] focus:border-[var(--ring)]",
  );
}
