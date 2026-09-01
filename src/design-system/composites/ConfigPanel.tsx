import type { ReactNode } from "react";
import { Heading } from "../primitives/Heading";
import { GlassCard } from "./GlassCard";

type ConfigPanelProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ConfigPanel({ title, description, children }: ConfigPanelProps) {
  return (
    <GlassCard>
      <Heading as="h2">{title}</Heading>
      {description ? (
        <p className="mt-1 text-sm text-[var(--fg-muted)]">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </GlassCard>
  );
}
