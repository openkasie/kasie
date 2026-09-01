import { getOrgOwnerUserId, getSlackUserIdForUser } from "@/lib/db/queries/orgs";
import {
  getProjectById,
  getProjectWithConfig,
  getSlackBotToken,
} from "@/lib/db/queries/projects";
import { createLogger } from "@/lib/log";
import { openSlackDm, postSlackMessage } from "@/lib/slack/message";
import { NOTHING_TO_REPORT } from "./constants";
import { isWithinWorkingHours } from "./gates";

const log = createLogger("proactive:deliver");

export type ProactiveDelivery = {
  projectId: string;
  source: "schedule" | "initiative";
  text: string;
  /** Slack channel ID; null/undefined falls back to a DM to the org owner. */
  channel?: string | null;
  /** Bolded above the message body when set (schedule titles). */
  title?: string | null;
};

async function resolveOwnerDm(projectId: string, botToken: string) {
  const project = await getProjectById(projectId);
  if (!project?.orgId) return null;

  const ownerUserId = await getOrgOwnerUserId(project.orgId);
  if (!ownerUserId) return null;

  const slackUserId = await getSlackUserIdForUser(ownerUserId);
  if (!slackUserId) return null;

  return openSlackDm(slackUserId, botToken);
}

/**
 * Post a completed proactive run's output to Slack. Runs triggered by a user
 * message get their reply through the Slack events route; schedule and
 * initiative runs have no inbound message, so this is their only delivery path.
 */
export async function deliverProactiveOutput(input: ProactiveDelivery) {
  const text = input.text.trim();
  if (!text || text.includes(NOTHING_TO_REPORT)) {
    log.info("delivery skipped", {
      projectId: input.projectId,
      source: input.source,
      reason: text ? "nothing_to_report" : "empty_output",
    });
    return;
  }

  // Initiative messages respect quiet hours; schedules fire at times the
  // operator chose explicitly, so they deliver as configured.
  if (input.source === "initiative") {
    const config = (await getProjectWithConfig(input.projectId))?.config;
    if (
      config &&
      !isWithinWorkingHours(new Date(), config.timezone, config.workingHours ?? undefined)
    ) {
      log.info("delivery skipped", {
        projectId: input.projectId,
        source: input.source,
        reason: "outside_working_hours",
      });
      return;
    }
  }

  const botToken = await getSlackBotToken(input.projectId);
  if (!botToken) {
    log.warn("delivery skipped: no slack bot token", { projectId: input.projectId });
    return;
  }

  const channel =
    input.channel ?? (await resolveOwnerDm(input.projectId, botToken));
  if (!channel) {
    log.warn("delivery skipped: no channel or owner DM", {
      projectId: input.projectId,
      source: input.source,
    });
    return;
  }

  const body = input.title ? `*${input.title}*\n${text}` : text;
  const ts = await postSlackMessage(channel, body, botToken);
  log.info("proactive output delivered", {
    projectId: input.projectId,
    source: input.source,
    channel,
    ok: Boolean(ts),
  });
}
