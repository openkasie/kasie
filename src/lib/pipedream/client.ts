import { PipedreamClient } from "@pipedream/sdk";
import { env, hasPipedream } from "@/lib/env";

let client: PipedreamClient | null = null;

export function getPipedreamClient(): PipedreamClient {
  if (!hasPipedream()) {
    throw new Error("Pipedream is not configured");
  }

  if (!client) {
    client = new PipedreamClient({
      projectEnvironment: env.PIPEDREAM_ENVIRONMENT ?? "development",
      clientId: env.PIPEDREAM_CLIENT_ID!,
      clientSecret: env.PIPEDREAM_CLIENT_SECRET!,
      projectId: env.PIPEDREAM_PROJECT_ID!,
    });
  }

  return client;
}

export async function getPipedreamAccessToken(): Promise<string> {
  const pd = getPipedreamClient();
  return pd.rawAccessToken;
}
