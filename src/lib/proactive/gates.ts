/** Pure gating rules for the initiative loop. Kept dependency-free for tests. */

export const INITIATIVE_IDLE_MS = 4 * 60 * 60 * 1000;
export const INITIATIVE_MIN_SPACING_MS = 4 * 60 * 60 * 1000;
export const INITIATIVE_MAX_PER_DAY = 3;

export type WorkingHours = {
  /** Local hour (0-23) the workday starts, inclusive. */
  startHour: number;
  /** Local hour (0-23) the workday ends, exclusive. */
  endHour: number;
  /** Workdays as JS weekday indices: 0 = Sunday .. 6 = Saturday. */
  days: number[];
};

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  startHour: 8,
  endHour: 18,
  days: [1, 2, 3, 4, 5],
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function localWeekdayAndHour(now: Date, timezone: string): { day: number; hour: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return { day: now.getUTCDay(), hour: now.getUTCHours() };
  }
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return { day: WEEKDAY_INDEX[weekday] ?? 0, hour };
}

/** True when `now` falls inside the team's local working hours. */
export function isWithinWorkingHours(
  now: Date,
  timezone: string,
  hours: WorkingHours = DEFAULT_WORKING_HOURS,
): boolean {
  const { day, hour } = localWeekdayAndHour(now, timezone);
  if (!hours.days.includes(day)) return false;
  return hour >= hours.startHour && hour < hours.endHour;
}

export type InitiativeGateInput = {
  proactiveEnabled: boolean;
  /** IANA timezone the team operates in; falls back to UTC when invalid. */
  timezone: string;
  /** Null falls back to DEFAULT_WORKING_HOURS. */
  workingHours: WorkingHours | null;
  /** Most recent user-driven run (slack / api / dashboard); null when none exist. */
  lastUserRunAt: Date | null;
  /** Idle anchor for fresh workspaces with no user runs yet. */
  projectCreatedAt: Date;
  /** Most recent initiative run; null when none exist. */
  lastInitiativeAt: Date | null;
  initiativesLast24h: number;
  now: Date;
};

export type InitiativeGateResult =
  | { fire: true }
  | { fire: false; reason: string };

export function evaluateInitiativeGate(
  input: InitiativeGateInput,
): InitiativeGateResult {
  if (!input.proactiveEnabled) {
    return { fire: false, reason: "proactive_disabled" };
  }

  if (
    !isWithinWorkingHours(
      input.now,
      input.timezone,
      input.workingHours ?? DEFAULT_WORKING_HOURS,
    )
  ) {
    return { fire: false, reason: "outside_working_hours" };
  }

  // A workspace with no user runs yet still deserves initiative — otherwise a
  // freshly installed Kasie sits silent forever. Idle from project creation.
  const idleAnchor = input.lastUserRunAt ?? input.projectCreatedAt;
  const idleMs = input.now.getTime() - idleAnchor.getTime();
  if (idleMs < INITIATIVE_IDLE_MS) {
    return { fire: false, reason: "operator_active" };
  }

  if (input.initiativesLast24h >= INITIATIVE_MAX_PER_DAY) {
    return { fire: false, reason: "daily_cap_reached" };
  }

  if (input.lastInitiativeAt) {
    const sinceLast = input.now.getTime() - input.lastInitiativeAt.getTime();
    if (sinceLast < INITIATIVE_MIN_SPACING_MS) {
      return { fire: false, reason: "too_soon_after_last_initiative" };
    }
  }

  return { fire: true };
}
