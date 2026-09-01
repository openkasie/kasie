import { Skeleton } from "../primitives/Skeleton";
import { GlassCard } from "./GlassCard";

type PageSkeletonProps = {
  /** Page title and description placeholder. Defaults to true. */
  header?: boolean;
  /** Number of stat cards in the top grid. */
  stats?: number;
  /** Rounded filter-tab bar placeholder. */
  tabs?: boolean;
  /** Tall chart placeholder. */
  chart?: boolean;
  /** Number of side-by-side config panels. */
  panels?: number;
  /** Number of stacked full-width form sections. */
  sections?: number;
  /** Number of tiles in a card grid (e.g. integrations). */
  cards?: number;
  /** Number of list rows. */
  rows?: number;
};

function StatCardSkeleton() {
  return (
    <GlassCard elevation="subtle" className="p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-20" />
    </GlassCard>
  );
}

function PanelSkeleton() {
  return (
    <GlassCard elevation="subtle" className="p-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-2 h-3 w-56" />
      <div className="mt-5 space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </GlassCard>
  );
}

function RowSkeleton() {
  return (
    <GlassCard elevation="subtle" className="flex items-center gap-3 p-4">
      <Skeleton className="size-8 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
    </GlassCard>
  );
}

export function PageSkeleton({
  header = true,
  stats = 0,
  tabs = false,
  chart = false,
  panels = 0,
  sections = 0,
  cards = 0,
  rows = 0,
}: PageSkeletonProps) {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <span className="sr-only">Loading</span>

      {header ? (
        <div className="mb-8 space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      ) : null}

      {stats > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : null}

      {tabs ? <Skeleton className="h-10 w-72 max-w-full rounded-full" /> : null}

      {chart ? (
        <GlassCard elevation="subtle" className="p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-48 w-full" />
        </GlassCard>
      ) : null}

      {panels > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: panels }, (_, i) => (
            <PanelSkeleton key={i} />
          ))}
        </div>
      ) : null}

      {sections > 0 ? (
        <div className="space-y-6">
          {Array.from({ length: sections }, (_, i) => (
            <PanelSkeleton key={i} />
          ))}
        </div>
      ) : null}

      {cards > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }, (_, i) => (
            <GlassCard key={i} elevation="subtle" className="p-5">
              <Skeleton className="size-10" />
              <Skeleton className="mt-4 h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-full" />
            </GlassCard>
          ))}
        </div>
      ) : null}

      {rows > 0 ? (
        <div className="space-y-2">
          {Array.from({ length: rows }, (_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
