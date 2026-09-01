import type { SelectHTMLAttributes } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import { inputClass } from "../utils/variants";
import { cn } from "../utils/cn";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ className, invalid, "aria-invalid": ariaInvalid, ...props }: SelectProps) {
  const isInvalid = invalid ?? (ariaInvalid === true || ariaInvalid === "true");
  return (
    <div className={cn("relative", className)}>
      <select
        aria-invalid={isInvalid || undefined}
        className={cn(inputClass(isInvalid), "cursor-pointer appearance-none pr-9")}
        {...props}
      />
      <CaretDownIcon
        size={16}
        weight="bold"
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
      />
    </div>
  );
}
