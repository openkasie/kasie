"use client";

import { cn } from "../utils/cn";

type FormFeedbackProps = {
  error?: string | null;
  success?: string | null;
  className?: string;
};

export function FormFeedback({ error, success, className }: FormFeedbackProps) {
  if (!error && !success) return null;

  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        error
          ? "bg-[var(--danger-bg)] text-[var(--danger-fg)]"
          : "bg-[var(--surface-subtle)] text-[var(--fg-muted)]",
        className,
      )}
    >
      {error ?? success}
    </p>
  );
}
