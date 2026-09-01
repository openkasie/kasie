import { cn } from "../utils/cn";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-lg bg-[var(--surface-elevated)] motion-reduce:animate-none",
        className,
      )}
    />
  );
}
