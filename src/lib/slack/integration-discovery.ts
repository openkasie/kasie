import { openSlackDm, postSlackMessage } from "@/lib/slack/message";
import { getSlackUserIdForUser } from "@/lib/db/queries/orgs";

export type DiscoveryDmThread = {
  channel: string;
  threadTs: string;
};

async function openOperatorDm(
  userId: string,
  botToken: string,
): Promise<DiscoveryDmThread | null> {
  const slackUserId = await getSlackUserIdForUser(userId);
  if (!slackUserId) return null;

  const channel = await openSlackDm(slackUserId, botToken);
  if (!channel) return null;

  return { channel, threadTs: "" };
}

export async function sendDiscoveryStarted(input: {
  userId: string;
  botToken: string;
  nickname: string;
  appSlug: string;
}): Promise<DiscoveryDmThread | null> {
  const dm = await openOperatorDm(input.userId, input.botToken);
  if (!dm) return null;

  const label = input.nickname.replace(/\s+account(\s+\d+)?$/i, "") || input.appSlug;
  const text = [
    `Analyzing your *${input.nickname}* (${label}) connection…`,
    "",
    "I'm probing the account, mapping available tools, and indexing findings into team memory. I'll reply in this thread when the deep dive is ready.",
  ].join("\n");

  const ts = await postSlackMessage(dm.channel, text, input.botToken);
  if (!ts) return null;

  return { channel: dm.channel, threadTs: ts };
}

export async function sendDiscoveryResults(input: {
  channel: string;
  threadTs: string;
  botToken: string;
  summary: string;
  followUp: string;
}) {
  await postSlackMessage(
    input.channel,
    input.summary,
    input.botToken,
    input.threadTs,
  );
  await postSlackMessage(
    input.channel,
    input.followUp,
    input.botToken,
    input.threadTs,
  );
}