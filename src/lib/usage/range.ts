export type UsageRange = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<UsageRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function parseUsageRange(raw: string | null | undefined): UsageRange {
  if (raw === "7d" || raw === "90d") return raw;
  return "30d";
}

export function usageRangeDays(range: UsageRange): number {
  return RANGE_DAYS[range];
}

export function usageRangeSince(range: UsageRange): Date {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - usageRangeDays(range));
  since.setUTCHours(0, 0, 0, 0);
  return since;
}

export function usageRangeLabel(range: UsageRange): string {
  if (range === "7d") return "Last 7 days";
  if (range === "90d") return "Last 90 days";
  return "Last 30 days";
}
