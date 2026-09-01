"use client";

import { cn } from "../utils/cn";

type RadioCardOption<T extends string> = {
  value: T;
  label: string;
  description: string;
  badge?: string;
  icon?: React.ReactNode;
};

type RadioCardGroupProps<T extends string> = {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: RadioCardOption<T>[];
};

export function RadioCardGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: RadioCardGroupProps<T>) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
              "focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--bg)]",
              selected
                ? "border-[var(--accent)] bg-[var(--surface-subtle)]"
                : "border-[var(--border-subtle)] hover:border-[var(--border-elevated)] hover:bg-[var(--surface-subtle)]",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="mt-1 accent-[var(--accent)] focus:outline-none"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {option.icon}
                <span className="font-medium">{option.label}</span>
                {option.badge ? (
                  <span className="rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--success-fg)]">
                    {option.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">{option.description}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
