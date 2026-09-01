import type { CreateTokenResponse } from "@pipedream/sdk";
import { getPipedreamClient } from "./client";
import { resolveExternalUserId } from "./external-user-id";
import type { IntegrationVisibility } from "@/lib/db/queries/integrations";

export async function createConnectToken(input: {
  projectId: string;
  userId: string;
  visibility: IntegrationVisibility;
  webhookUri?: string;
  allowedOrigins?: string[];
}) {
  const client = getPipedreamClient();
  const externalUserId = resolveExternalUserId({
    projectId: input.projectId,
    userId: input.userId,
    visibility: input.visibility,
  });

  const result = await client.tokens.create({
    externalUserId,
    webhookUri: input.webhookUri,
    allowedOrigins: input.allowedOrigins,
  });

  const wrapped = result as unknown as { data?: CreateTokenResponse };
  const data = wrapped.data ?? (result as unknown as CreateTokenResponse);

  return {
    token: data.token,
    expiresAt: data.expiresAt,
    connectLinkUrl: data.connectLinkUrl,
    externalUserId,
  };
}
