import type { LabelHTMLAttributes } from "react";
import { cn } from "../utils/cn";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

export function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <label
      className={cn("text-sm font-medium text-[var(--fg-muted)]", className)}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-[var(--danger)]" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  );
}
