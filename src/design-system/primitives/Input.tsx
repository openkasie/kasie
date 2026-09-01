import type { InputHTMLAttributes } from "react";
import { inputClass } from "../utils/variants";
import { cn } from "../utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid, "aria-invalid": ariaInvalid, ...props }: InputProps) {
  const isInvalid = invalid ?? (ariaInvalid === true || ariaInvalid === "true");
  return (
    <input
      aria-invalid={isInvalid || undefined}
      className={cn(inputClass(isInvalid), className)}
      {...props}
    />
  );
}
