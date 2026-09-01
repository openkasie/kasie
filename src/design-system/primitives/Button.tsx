import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "../utils/variants";
import { cn } from "../utils/cn";
import { Spinner } from "./Spinner";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const spinnerSize = size === "lg" ? 18 : size === "sm" ? 13 : 15;
  return (
    <button
      className={cn(
        buttonClass(variant, size),
        fullWidth && "w-full",
        loading && "relative",
        className,
      )}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="absolute inset-0 grid place-items-center">
            <Spinner size={spinnerSize} />
          </span>
          <span className="inline-flex items-center gap-2 invisible">
            {icon}
            {children}
          </span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
