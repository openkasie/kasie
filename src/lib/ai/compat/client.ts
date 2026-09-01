import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";

let client: ReturnType<typeof createOpenAI> | null = null;

function normalizeGatewayBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) return trimmed;
  return `${trimmed}/v1`;
}

export function getGatewayBaseUrl(): string {
  if (!env.AI_GATEWAY_URL) {
    throw new Error("AI_GATEWAY_URL is not configured");
  }
  return normalizeGatewayBaseUrl(env.AI_GATEWAY_URL);
}

export function getGatewayClient() {
  if (!env.AI_GATEWAY_URL || !env.AI_GATEWAY_API_KEY) {
    throw new Error("AI gateway is not configured");
  }

  client ??= createOpenAI({
    apiKey: env.AI_GATEWAY_API_KEY,
    baseURL: getGatewayBaseUrl(),
  });

  return client;
}