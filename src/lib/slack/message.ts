type SlackApiResponse = {
  ok: boolean;
  error?: string;
  channel?: { id?: string };
  ts?: string;
};

export const SLACK_PROCESSING_REACTION = "eyes";

const CODE_SPAN = /(`[^`]*`)/g;

function transformOutsideCode(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
    .replace(/__([^_\n]+)__/g, "*$1*")
    .replace(/^[\t ]*[-*]\s+/gm, "• ");
}

export function normalizeSlackMrkdwn(text: string): string {
  return text
    .split(CODE_SPAN)
    .map((segment, index) =>
      index % 2 === 1 ? segment : transformOutsideCode(segment),
    )
    .join("");
}

async function slackApi<T extends SlackApiResponse>(
  method: string,
  botToken: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return (await res.json()) as T;
}

export async function openSlackDm(
  slackUserId: string,
  botToken: string,
): Promise<string | null> {
  const payload = await slackApi<SlackApiResponse>("conversations.open", botToken, {
    users: slackUserId,
  });
  if (!payload.ok || !payload.channel?.id) {
    console.error("slack conversations.open failed", payload.error);
    return null;
  }
  return payload.channel.id;
}

export async function postSlackMessage(
  channel: string,
  text: string,
  botToken: string,
  threadTs?: string,
): Promise<string | undefined> {
  if (!botToken) return;

  const payload = await slackApi<SlackApiResponse>("chat.postMessage", botToken, {
    channel,
    text: normalizeSlackMrkdwn(text),
    mrkdwn: true,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  });
  if (!payload.ok) {
    console.error("slack chat.postMessage failed", payload.error);
    return;
  }
  return payload.ts;
}

async function addSlackReaction(
  channel: string,
  timestamp: string,
  name: string,
  botToken: string,
) {
  if (!botToken) return;

  const payload = await slackApi<SlackApiResponse>("reactions.add", botToken, {
    channel,
    timestamp,
    name,
  });
  if (!payload.ok && payload.error !== "already_reacted") {
    console.error("slack reactions.add failed", payload.error);
  }
}

export async function removeSlackReaction(
  channel: string,
  timestamp: string,
  name: string,
  botToken: string,
) {
  if (!botToken) return;

  const payload = await slackApi<SlackApiResponse>("reactions.remove", botToken, {
    channel,
    timestamp,
    name,
  });
  if (!payload.ok && payload.error !== "no_reaction") {
    console.error("slack reactions.remove failed", payload.error);
  }
}

export async function signalSlackProcessing(input: {
  channel: string;
  messageTs: string;
  botToken: string;
}) {
  await addSlackReaction(
    input.channel,
    input.messageTs,
    SLACK_PROCESSING_REACTION,
    input.botToken,
  );
}

export async function completeSlackMessage(input: {
  channel: string;
  messageTs: string;
  threadTs: string;
  botToken: string;
  text: string;
}) {
  await postSlackMessage(input.channel, input.text, input.botToken, input.threadTs);
  await removeSlackReaction(
    input.channel,
    input.messageTs,
    SLACK_PROCESSING_REACTION,
    input.botToken,
  );
}
