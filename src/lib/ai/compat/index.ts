import { embed } from "ai";
import { createLogger } from "@/lib/log";
import { env } from "@/lib/env";
import { discoverModels } from "./catalog";
import { getGatewayClient } from "./client";
import { resolveEmbeddingModelId, resolveGatewayModelId } from "./resolve";

const log = createLogger("ai-gateway-compat");

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export async function getLanguageModel(modelId: string) {
  const catalog = await discoverModels();
  const resolved = resolveGatewayModelId(modelId, catalog);
  if (!resolved.matched) {
    log.warn("model not found in gateway catalog, using configured id", {
      configuredId: modelId,
    });
  }
  return getGatewayClient()(resolved.id);
}

async function getEmbeddingModel(modelId?: string) {
  const configured = modelId ?? env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const catalog = await discoverModels();
  const resolved = resolveEmbeddingModelId(configured, catalog);
  if (!resolved.matched && resolved.id === configured) {
    log.warn("embedding model not found in gateway catalog, using configured id", {
      configuredId: configured,
    });
  } else if (resolved.id !== configured) {
    log.info("embedding model resolved from catalog", {
      configuredId: configured,
      resolvedId: resolved.id,
    });
  }
  return getGatewayClient().embedding(resolved.id);
}

export async function embedText(text: string, modelId?: string): Promise<number[]> {
  const result = await embed({
    model: await getEmbeddingModel(modelId),
    value: text,
  });
  return result.embedding;
}
