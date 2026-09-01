"use client";

import { type ReactNode } from "react";
import { CircleIcon } from "@phosphor-icons/react";
import { cn } from "../utils/cn";

export type ModelTierSpec = {
  model: string;
  maxOutputTokens: number;
  estCost: string;
};

type ModelTierCardProps = {
  tier: string;
  label: string;
  description: string;
  specs: ModelTierSpec;
  selected: boolean;
  pending?: boolean;
  recommended?: boolean;
  onSelect: () => void;
};

function SpecRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-[var(--fg-muted)]">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}

export function ModelTierCard({
  label,
  description,
  specs,
  selected,
  pending = false,
  recommended = false,
  onSelect,
}: ModelTierCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={pending}
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col rounded-xl border p-5 text-left transition-[border-color,background-color,box-shadow,transform] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        selected
          ? "border-[var(--accent)] bg-[var(--surface)] shadow-[0_0_0_1px_var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface-subtle)] hover:border-[var(--border-elevated)] hover:bg-[var(--surface)] hover:shadow-sm active:scale-[0.99]",
        pending && "cursor-wait opacity-60",
        selected && pending && "cursor-wait",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">{label}</p>
          {recommended ? (
            <span className="inline-block rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--success-fg)]">
              Recommended
            </span>
          ) : null}
        </div>
        <CircleIcon
          size={20}
          weight={selected ? "fill" : "regular"}
          aria-hidden
          className={cn(
            "mt-0.5 shrink-0 transition-colors",
            selected
              ? "text-[var(--accent)]"
              : "text-[var(--fg-muted)] group-hover:text-[var(--fg)]",
          )}
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)]">{description}</p>

      <dl className="mt-4 divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
        <SpecRow
          label="Model"
          value={
            <span className="block truncate font-mono text-xs" title={specs.model}>
              {specs.model}
            </span>
          }
        />
        <SpecRow
          label="Max tokens"
          value={specs.maxOutputTokens.toLocaleString("en-US")}
        />
        <SpecRow label="Est. cost" value={specs.estCost} />
      </dl>
    </button>
  );
}
