import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "../client";
import { kasieSchedules, type Schedule } from "../schema";

export async function getSchedule(projectId: string, scheduleId: string) {
  const [schedule] = await db
    .select()
    .from(kasieSchedules)
    .where(
      and(eq(kasieSchedules.id, scheduleId), eq(kasieSchedules.projectId, projectId)),
    )
    .limit(1);
  return schedule ?? null;
}

export async function createSchedule(input: {
  projectId: string;
  title: string;
  cron: string;
  timezone: string;
  prompt: string;
  channel: string | null;
  enabled: boolean;
  nextRunAt: Date | null;
}) {
  const [schedule] = await db.insert(kasieSchedules).values(input).returning();
  return schedule;
}

export async function updateSchedule(
  projectId: string,
  scheduleId: string,
  patch: Partial<
    Pick<
      Schedule,
      "title" | "cron" | "timezone" | "prompt" | "channel" | "enabled" | "nextRunAt"
    >
  >,
) {
  const [schedule] = await db
    .update(kasieSchedules)
    .set(patch)
    .where(
      and(eq(kasieSchedules.id, scheduleId), eq(kasieSchedules.projectId, projectId)),
    )
    .returning();
  return schedule ?? null;
}

export async function deleteSchedule(projectId: string, scheduleId: string) {
  const [deleted] = await db
    .delete(kasieSchedules)
    .where(
      and(eq(kasieSchedules.id, scheduleId), eq(kasieSchedules.projectId, projectId)),
    )
    .returning({ id: kasieSchedules.id, title: kasieSchedules.title });
  return deleted ?? null;
}

export async function listDueSchedules(now: Date) {
  return db
    .select()
    .from(kasieSchedules)
    .where(and(eq(kasieSchedules.enabled, true), lte(kasieSchedules.nextRunAt, now)));
}

export async function listEnabledSchedulesMissingNextRun() {
  return db
    .select()
    .from(kasieSchedules)
    .where(and(eq(kasieSchedules.enabled, true), isNull(kasieSchedules.nextRunAt)));
}

/**
 * Atomically claim a due schedule by advancing next_run_at with optimistic
 * concurrency on its previous value. Exactly one of any concurrent ticks
 * wins; the rest observe zero updated rows and skip.
 */
export async function claimDueSchedule(
  scheduleId: string,
  previousNextRunAt: Date,
  nextRunAt: Date | null,
  now: Date,
) {
  const claimed = await db
    .update(kasieSchedules)
    .set({ nextRunAt, lastRunAt: now })
    .where(
      and(
        eq(kasieSchedules.id, scheduleId),
        eq(kasieSchedules.nextRunAt, previousNextRunAt),
      ),
    )
    .returning({ id: kasieSchedules.id });
  return claimed.length > 0;
}

/** Backfill next_run_at for enabled schedules that never had one computed. */
export async function initializeNextRun(scheduleId: string, nextRunAt: Date) {
  await db
    .update(kasieSchedules)
    .set({ nextRunAt })
    .where(and(eq(kasieSchedules.id, scheduleId), isNull(kasieSchedules.nextRunAt)));
}

/** Disable a schedule whose cron expression can no longer be evaluated. */
export async function disableBrokenSchedule(scheduleId: string) {
  await db
    .update(kasieSchedules)
    .set({ enabled: false, nextRunAt: null })
    .where(eq(kasieSchedules.id, scheduleId));
}
