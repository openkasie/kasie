export type SlackCopyKind =
  | "welcome"
  | "welcome_followup"
  | "ack"
  | "discovery_started"
  | "discovery_summary"
  | "discovery_report"
  | "budget_exceeded"
  | "processing_failed"
  | "empty_response";

export type SlackCopyContext = {
  workspaceName?: string;
  operatorName?: string | null;
  userMessage?: string;
  integrationNickname?: string;
  appSlug?: string;
  /** Pre-formatted plain-language discovery bullets for copy generation. */
  discoveryFindings?: string;
  /** Distilled exploration narrative — no JSON. */
  discoveryNotes?: string;
};

export const COPY_LIMITS: Record<SlackCopyKind, number> = {
  welcome: 900,
  welcome_followup: 500,
  ack: 280,
  discovery_started: 320,
  discovery_summary: 420,
  discovery_report: 1400,
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

    case "discovery_started": {
      const nickname = ctx.integrationNickname?.trim() || "the new integration";
      const app = ctx.appSlug?.trim() || "this app";
      return [
        `You just connected *${nickname}* (${app}) and are starting an account discovery pass.`,
        "Write a short DM (1-2 sentences) letting them know you are looking around their account now.",
        "Sound like a coworker who picked up the task — vary your phrasing, reference the integration by name, mention you will follow up in this thread with what you find.",
        "Do not use canned status-update language like 'Analyzing your connection', 'probing the account', or 'deep dive is ready'.",
      ].join(" ");
    }

    case "discovery_summary": {
      const nickname = ctx.integrationNickname?.trim() || "the integration";
      const findings = ctx.discoveryFindings?.trim() || "exploration finished";
      return [
        `You finished exploring *${nickname}* and are posting a short headline in Slack.`,
        "Write 1-2 warm, personal sentences — like a coworker reporting back, not a system log.",
        "Share the headline in plain English (what you found at a glance). No section headers, no bullet lists, no JSON, no UUIDs.",
        "Findings to draw from:",
        findings,
      ].join("\n");
    }

    case "discovery_report": {
      const nickname = ctx.integrationNickname?.trim() || "the integration";
      const app = ctx.appSlug?.trim() || "this app";
      const findings = ctx.discoveryFindings?.trim() || "";
      const notes = ctx.discoveryNotes?.trim() || "";
      return [
        `Write a thread reply summarizing what you learned from *${nickname}* (${app}).`,
        "Audience: a normal person, not an engineer. Personal, warm, scannable.",
        "Use at most 3 short sections with Slack bold headers (*Like this*).",
        "Suggested flow: what you looked at → highlights worth knowing → you're set to help without them repeating context.",
        "Max ~6 bullets total across the message. Plain language only.",
        "Never paste JSON, raw tool output, code, or long IDs. Say 'your project' or 'your main tables' instead of UUIDs.",
        "Do not list has_content, tool payloads, or entity/relation/target triples.",
        "Do not add a 'What's in your account' section that repeats raw data — synthesize in plain English.",
        "No 'try asking me' prompts. No 'Account discovery report' title.",
        findings ? `Structured findings:\n${findings}` : "",
        notes ? `Exploration context (distill, do not copy verbatim):\n${notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

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
