import { getSlackUserIdForUser } from "@/lib/db/queries/orgs";
import { generateSlackCopy } from "./copy";
import { openSlackDm, postSlackMessage } from "./message";

export async function sendOperatorWelcome(input: {
  userId: string;
  projectId: string;
  botToken: string;
  workspaceName: string;
  operatorName?: string | null;
}) {
  const slackUserId = await getSlackUserIdForUser(input.userId);
  if (!slackUserId) return;

  const channel = await openSlackDm(slackUserId, input.botToken);
  if (!channel) return;

  const copyContext = {
    workspaceName: input.workspaceName,
    operatorName: input.operatorName,
  };

  const welcome = await generateSlackCopy({
    projectId: input.projectId,
    kind: "welcome",
    context: copyContext,
  });
  const welcomeTs = await postSlackMessage(channel, welcome, input.botToken);

  const followUp = await generateSlackCopy({
    projectId: input.projectId,
    kind: "welcome_followup",
    context: copyContext,
  });
  await postSlackMessage(
    channel,
    followUp,
    input.botToken,
    welcomeTs ?? undefined,
  );
}
