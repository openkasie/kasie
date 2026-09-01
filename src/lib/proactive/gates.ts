/** Pure gating rules for the initiative loop. Kept dependency-free for tests. */

export const INITIATIVE_IDLE_MS = 4 * 60 * 60 * 1000;
export const INITIATIVE_MIN_SPACING_MS = 4 * 60 * 60 * 1000;
export const INITIATIVE_MAX_PER_DAY = 3;

export type InitiativeGateInput = {
  proactiveEnabled: boolean;
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
