"use client";

import { useId, type ReactElement, type ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
import { Label } from "../primitives/Label";
import { cn } from "../utils/cn";

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Wires a label, optional hint, and validation error to a single control,
 * injecting id / aria-describedby / aria-invalid into the child when it is a
 * single element that accepts them.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  let control = children;
  if (isValidElement(children) && !htmlFor) {
    const child = children as ReactElement<Record<string, unknown>>;
    control = cloneElement(child, {
      id: child.props.id ?? controlId,
      "aria-describedby": [child.props["aria-describedby"], describedBy]
        .filter(Boolean)
        .join(" ") || undefined,
      "aria-invalid": error ? true : child.props["aria-invalid"],
    });
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={controlId} required={required}>
          {label}
        </Label>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-[var(--fg-muted)]">
          {hint}
        </p>
      ) : null}
      {control}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-[var(--danger-fg)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
