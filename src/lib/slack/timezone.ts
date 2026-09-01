import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { kasieProjectConfig } from "@/lib/db/schema";
import { createLogger } from "@/lib/log";
import { getSlackUserTimezone } from "./message";

const log = createLogger("slack:timezone");

/**
 * Adopt the installer's Slack timezone as the project timezone, but only
 * while the config still holds the default UTC so an explicit dashboard
 * choice is never overwritten.
 */
export async function adoptInstallerTimezone(
  projectId: string,
  slackUserId: string | undefined,
  botToken: string | undefined,
): Promise<void> {
  if (!slackUserId || !botToken) return;

  try {
    const tz = await getSlackUserTimezone(slackUserId, botToken);
    if (!tz || tz === "UTC") return;

    const updated = await db
      .update(kasieProjectConfig)
      .set({ timezone: tz, updatedAt: new Date() })
      .where(
        and(
          eq(kasieProjectConfig.projectId, projectId),
          eq(kasieProjectConfig.timezone, "UTC"),
        ),
      )
      .returning({ id: kasieProjectConfig.id });

    if (updated.length > 0) {
      log.info("project timezone adopted from installer", { projectId, tz });
    }
  } catch (err) {
    log.error("timezone auto-detect failed", { projectId }, err);
  }
}
