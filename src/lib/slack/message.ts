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

type SlackUserResponse = SlackApiResponse & {
  user?: {
    name?: string;
    real_name?: string;
    profile?: { display_name?: string; real_name?: string };
  };
};

/** Resolve a Slack user id to a human-readable name (display name preferred). */
export async function getSlackUserName(
  slackUserId: string,
  botToken: string,
): Promise<string | null> {
  if (!botToken) return null;

  const res = await fetch(
    `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
    {
      headers: { Authorization: `Bearer ${botToken}` },
      cache: "no-store",
    },
  );
  const payload = (await res.json()) as SlackUserResponse;
  if (!payload.ok || !payload.user) {
    console.error("slack users.info failed", payload.error);
    return null;
  }
  return (
    payload.user.profile?.display_name ||
    payload.user.profile?.real_name ||
    payload.user.real_name ||
    payload.user.name ||
    null
  );
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

/**
 * Post an approve/reject prompt for a pending action. Button values use the
 * `verb:actionId:runId` format the interactions route expects.
 */
export async function postSlackApprovalRequest(input: {
  channel: string;
  botToken: string;
  toolName: string;
  actionId: string;
  runId: string;
  threadTs?: string;
}): Promise<string | undefined> {
  if (!input.botToken) return;

  const fallback = `Approval needed: ${input.toolName}`;
  const payload = await slackApi<SlackApiResponse>("chat.postMessage", input.botToken, {
    channel: input.channel,
    text: fallback,
    ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `This one needs your sign-off before I run it: \`${input.toolName}\``,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            style: "primary",
            text: { type: "plain_text", text: "Approve" },
            action_id: "approve_action",
            value: `approve:${input.actionId}:${input.runId}`,
          },
          {
            type: "button",
            style: "danger",
            text: { type: "plain_text", text: "Reject" },
            action_id: "reject_action",
            value: `reject:${input.actionId}:${input.runId}`,
          },
        ],
      },
    ],
  });
  if (!payload.ok) {
    console.error("slack approval request failed", payload.error);
    return;
  }
  return payload.ts;
}

/** Edit an existing message in place; returns false when the update failed. */
export async function updateSlackMessage(
  channel: string,
  ts: string,
  text: string,
  botToken: string,
): Promise<boolean> {
  if (!botToken) return false;

  const payload = await slackApi<SlackApiResponse>("chat.update", botToken, {
    channel,
    ts,
    text: normalizeSlackMrkdwn(text),
  });
  if (!payload.ok) {
    console.error("slack chat.update failed", payload.error);
    return false;
  }
  return true;
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
  /** When set, the ack message is edited into the final answer instead of posting a second reply. */
  ackTs?: string;
}) {
  const updated = input.ackTs
    ? await updateSlackMessage(input.channel, input.ackTs, input.text, input.botToken)
    : false;
  if (!updated) {
    await postSlackMessage(input.channel, input.text, input.botToken, input.threadTs);
  }
  await removeSlackReaction(
    input.channel,
    input.messageTs,
    SLACK_PROCESSING_REACTION,
    input.botToken,
  );
}
