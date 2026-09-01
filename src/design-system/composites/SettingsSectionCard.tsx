import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { GlassCard } from "./GlassCard";

type SettingsSectionCardProps = {
  title?: string;
  description?: string;
  footer?: ReactNode;
  variant?: "default" | "destructive";
  children: ReactNode;
  className?: string;
};

export function SettingsSectionCard({
  title,
  description,
  footer,
  variant = "default",
  children,
  className,
}: SettingsSectionCardProps) {
  return (
    <GlassCard
      elevation="subtle"
      className={cn(
        variant === "destructive" && "border border-[var(--danger-border)]",
        className,
      )}
    >
      {title ? (
        <h2 className="text-base font-semibold text-[var(--fg)]">{title}</h2>
      ) : null}
      {description ? (
        <p className="mt-1 text-sm text-[var(--fg-muted)]">{description}</p>
      ) : null}
      <div className={cn(title || description ? "mt-4" : undefined)}>{children}</div>
      {footer ? (
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
          {footer}
        </div>
      ) : null}
    </GlassCard>
  );
}
