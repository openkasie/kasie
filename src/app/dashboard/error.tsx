"use client";

import { RouteError } from "@/design-system";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <RouteError
        error={error}
        reset={reset}
        description="We couldn't load your dashboard. Your data is safe. Give it another try in a moment."
      />
    </div>
  );
}
