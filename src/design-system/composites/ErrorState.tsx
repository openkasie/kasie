"use client";

import { useEffect } from "react";
import { ArrowClockwiseIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "../primitives/Button";
import { GlassCard } from "./GlassCard";

type ErrorStateProps = {
  title?: string;
  description?: string;
  /** Server error reference shown in small print so support can trace it. */
  digest?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this page. Your data is safe. Give it another try in a moment.",
  digest,
  onRetry,
}: ErrorStateProps) {
  return (
    <GlassCard elevation="subtle" className="flex flex-col items-center py-16 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-[var(--danger-bg)] text-[var(--danger-fg)]">
        <WarningCircleIcon size={24} weight="fill" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      <p className="mt-2 max-w-md text-sm text-[var(--fg-muted)]">{description}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-6"
          onClick={onRetry}
          icon={<ArrowClockwiseIcon size={15} aria-hidden />}
        >
          Try again
        </Button>
      ) : null}
      {digest ? (
        <p className="mt-4 font-mono text-xs text-[var(--fg-subtle)]">Ref: {digest}</p>
      ) : null}
    </GlassCard>
  );
}

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
};

/** Drop-in body for Next.js `error.tsx` boundaries. */
export function RouteError({ error, reset, title, description }: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title={title}
      description={description}
      digest={error.digest}
      onRetry={reset}
    />
  );
}
