import { generateSlackCopy } from "@/lib/slack/copy";
import { openSlackDm, postSlackMessage } from "@/lib/slack/message";
import { getSlackUserIdForUser } from "@/lib/db/queries/orgs";

export type DiscoveryDmThread = {
  channel: string;
  threadTs: string;
};

function integrationLabel(nickname: string, appSlug: string): string {
  return nickname.replace(/\s+account(\s+\d+)?$/i, "") || appSlug;
}

function discoveryStartedFallback(nickname: string, label: string): string {
  const variants = [
    `*${nickname}* is connected — I'm going to look around your ${label} account and pull what I find into team memory. I'll follow up here.`,
    `Got *${nickname}* hooked up. Give me a minute to map what's in your ${label} account; I'll reply in this thread.`,
    `Starting on *${nickname}* now — I'll inventory your ${label} setup and drop the highlights here when I'm done.`,
    `*${nickname}* just came online. I'm checking your ${label} account and will post what I find in this thread.`,
  ];
  const idx = Math.abs(nickname.split("").reduce((h, c) => h + c.charCodeAt(0), 0)) % variants.length;
  return variants[idx];
}

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

async function buildDiscoveryStartedText(input: {
  projectId: string;
  nickname: string;
  appSlug: string;
}): Promise<string> {
  const label = integrationLabel(input.nickname, input.appSlug);
  try {
    const text = await generateSlackCopy({
      projectId: input.projectId,
      kind: "discovery_started",
      context: {
        integrationNickname: input.nickname,
        appSlug: input.appSlug,
      },
    });
    if (text && !text.startsWith("[stub]")) return text;
  } catch {
    // fall through to varied static fallback
  }
  return discoveryStartedFallback(input.nickname, label);
}

export async function sendDiscoveryStarted(input: {
  projectId: string;
  userId: string;
  botToken: string;
  nickname: string;
  appSlug: string;
}): Promise<DiscoveryDmThread | null> {
  const dm = await openOperatorDm(input.userId, input.botToken);
  if (!dm) return null;

  const text = await buildDiscoveryStartedText(input);
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
