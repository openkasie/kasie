"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { cn } from "../utils/cn";
import { inputClass } from "../utils/variants";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <MagnifyingGlassIcon
        size={18}
        weight="regular"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass(), "pl-10")}
      />
    </div>
  );
}
