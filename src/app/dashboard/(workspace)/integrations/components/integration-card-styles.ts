import { cn } from "@/design-system/utils/cn";

/** Focus ring for integration links and buttons. */
export const integrationFocusRing = cn(
  "rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
);

/** Parent wrapper — enables group-hover on child cards. */
export const integrationInteractiveGroup = "group block w-full text-left";

/** GlassCard surface feedback (requires `group` on parent). */
export const integrationCardHover = cn(
  "transition-[border-color,background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
  "group-hover:border-[var(--border-elevated)] group-hover:bg-[var(--surface)] group-hover:shadow-[var(--shadow-glass)]",
  "motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:translate-y-0 motion-safe:group-active:scale-[0.99]",
  "motion-reduce:transform-none motion-reduce:transition-colors",
);

export const integrationAppIconHover = cn(
  "transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
  "motion-safe:group-hover:scale-105 motion-reduce:transform-none",
);

export const integrationConnectLabelHover = cn(
  "transition-[color,transform] duration-150",
  "group-hover:text-[var(--ring)] motion-safe:group-hover:translate-x-0.5 motion-reduce:transform-none",
);

export const integrationChevronHover = cn(
  "shrink-0 text-[var(--fg-muted)] transition-[color,transform] duration-150",
  "group-hover:text-[var(--accent)] motion-safe:group-hover:translate-x-0.5 motion-reduce:transform-none",
);

export const integrationToolRowHover = cn(
  "transition-colors duration-150 hover:bg-[var(--surface-subtle)]",
);

export const integrationBreadcrumbLinkHover = cn(
  "rounded-sm transition-colors duration-150 hover:text-[var(--fg)] hover:underline underline-offset-2",
);
