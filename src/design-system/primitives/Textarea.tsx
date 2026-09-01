import type { TextareaHTMLAttributes } from "react";
import { inputClass } from "../utils/variants";
import { cn } from "../utils/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ className, invalid, "aria-invalid": ariaInvalid, ...props }: TextareaProps) {
  const isInvalid = invalid ?? (ariaInvalid === true || ariaInvalid === "true");
  return (
    <textarea
      aria-invalid={isInvalid || undefined}
      className={cn(inputClass(isInvalid), "min-h-24 resize-y", className)}
      {...props}
    />
  );
}
