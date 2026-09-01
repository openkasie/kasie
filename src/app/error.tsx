"use client";

import { RouteError } from "@/design-system";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl items-center px-4">
      <div className="w-full">
        <RouteError error={error} reset={reset} />
      </div>
    </div>
  );
}
