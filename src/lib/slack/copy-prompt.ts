export type SlackCopyKind =
  | "welcome"
  | "welcome_followup"
  | "ack"
  | "budget_exceeded"
  | "processing_failed"
  | "empty_response";

export type SlackCopyContext = {
  workspaceName?: string;
  operatorName?: string | null;
  userMessage?: string;
};

export const COPY_LIMITS: Record<SlackCopyKind, number> = {
  welcome: 900,
  welcome_followup: 500,
  ack: 280,
  budget_exceeded: 220,
  processing_failed: 220,
  empty_response: 400,
};

export function buildSlackCopyPrompt(
  kind: SlackCopyKind,
  ctx: SlackCopyContext,
): string {
  const operator = ctx.operatorName?.trim() || "the workspace owner";
  const workspace = ctx.workspaceName?.trim() || "this workspace";
  const userMessage = ctx.userMessage?.trim() || "";

  switch (kind) {
    case "welcome":
      return [
        `${operator} just finished connecting ${workspace} to Slack.`,
        "Write your first direct message as their AI coworker.",
        "Cover: messaging you in this DM, @mentioning you in channels (after /invite), and configuring skills or integrations in the dashboard.",
        "Sound natural and helpful — not a generic template.",
      ].join(" ");

    case "welcome_followup":
      return [
        `Reply in-thread to ${operator} after your welcome message for ${workspace}.`,
        "Brief follow-up: you are ready to help, suggest one concrete first task they could give you today, and invite them to reply here.",
        operator !== "the workspace owner"
          ? `Address them as ${operator} when it reads naturally.`
          : "Address them warmly.",
      ].join(" ");

    case "ack":
      return [
        "The user just sent this message:",
        `"${userMessage}"`,
        "Write one short in-thread reply (under 2 sentences) acknowledging you received it and are working on it.",
        "Reference what they asked — do not answer the question yet.",
      ].join("\n");

    case "budget_exceeded":
      return [
        `${operator} sent a message but ${workspace} has exceeded its monthly usage budget.`,
        "Politely explain you cannot run the request right now because of the budget cap, and that an admin can raise it in the dashboard.",
      ].join(" ");

    case "processing_failed":
      return [
        "You failed to finish a request for this user.",
        userMessage ? `Their message was: "${userMessage}"` : "",
        "Apologize briefly and ask them to try again.",
      ]
        .filter(Boolean)
        .join(" ");

    case "empty_response":
      return [
        "You finished processing but produced no visible reply.",
        userMessage ? `The user asked: "${userMessage}"` : "",
        "Write a brief helpful follow-up inviting them to clarify or try again.",
      ]
        .filter(Boolean)
        .join(" ");
  }
}
