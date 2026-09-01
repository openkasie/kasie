"use client";

import { cn } from "../utils/cn";

type Tab = {
  id: string;
  label: string;
  count?: number;
};

type TabsProps = {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
};

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            active === tab.id
              ? "bg-[var(--surface-elevated)] text-[var(--fg)] shadow-sm"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
          )}
        >
          {tab.label}
          {tab.count != null ? (
            <span className="ml-1.5 tabular-nums text-[var(--fg-muted)]">{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
