import type { ReactNode } from "react";
import { GlassCard } from "./GlassCard";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <GlassCard elevation="subtle" className="flex flex-col items-center py-16 text-center">
      {icon ? <div className="mb-4 text-[var(--fg-muted)]">{icon}</div> : null}
      <p className="font-medium">{title}</p>
      <p className="mt-2 max-w-md text-sm text-[var(--fg-muted)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </GlassCard>
  );
}
