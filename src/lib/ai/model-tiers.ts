import { env } from "@/lib/env";
import { discoverModels } from "./compat/catalog";
import { resolveGatewayModelId } from "./compat/resolve";
import {
  pickTierDefaultModels,
  STATIC_TIER_MODELS,
} from "./tier-defaults.pick";
import type { ModelConfig, ModelTier } from "./types";

const CACHE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_MAX_OUTPUT_TOKENS: Record<ModelTier, number> = {
  ultra: 8192,
  smart: 4096,
  balanced: 2048,
};

const ENV_MODEL: Record<ModelTier, string | undefined> = {
  ultra: env.MODEL_TIER_ULTRA,
  smart: env.MODEL_TIER_SMART,
  balanced: env.MODEL_TIER_BALANCED,
};

const ENV_MAX_OUTPUT: Record<ModelTier, number | undefined> = {
  ultra: env.MODEL_TIER_ULTRA_MAX_OUTPUT_TOKENS,
  smart: env.MODEL_TIER_SMART_MAX_OUTPUT_TOKENS,
  balanced: env.MODEL_TIER_BALANCED_MAX_OUTPUT_TOKENS,
};

let cache: { tiers: Record<ModelTier, ModelConfig>; fetchedAt: number } | null =
  null;
let inflight: Promise<Record<ModelTier, ModelConfig>> | null = null;

function resolveTierModel(
  tier: ModelTier,
  configuredId: string,
  catalog: Awaited<ReturnType<typeof discoverModels>>,
): string {
  const resolved = resolveGatewayModelId(configuredId, catalog);
  return resolved.matched ? resolved.id : configuredId;
}

function buildTierConfig(
  tier: ModelTier,
  modelId: string,
): ModelConfig {
  return {
    model: modelId,
    maxOutputTokens: ENV_MAX_OUTPUT[tier] ?? DEFAULT_MAX_OUTPUT_TOKENS[tier],
  };
}

function buildStaticTiers(): Record<ModelTier, ModelConfig> {
  return {
    ultra: buildTierConfig(
      "ultra",
      ENV_MODEL.ultra ?? STATIC_TIER_MODELS.ultra,
    ),
    smart: buildTierConfig(
      "smart",
      ENV_MODEL.smart ?? STATIC_TIER_MODELS.smart,
    ),
    balanced: buildTierConfig(
      "balanced",
      ENV_MODEL.balanced ?? STATIC_TIER_MODELS.balanced,
    ),
  };
}

async function resolveFromGateway(): Promise<Record<ModelTier, ModelConfig>> {
  const catalog = await discoverModels();
  const picked = pickTierDefaultModels(catalog);
  const tiers = ["ultra", "smart", "balanced"] as const;

  return Object.fromEntries(
    tiers.map((tier) => {
      const configured = ENV_MODEL[tier] ?? picked[tier];
      const model = resolveTierModel(tier, configured, catalog);
      return [tier, buildTierConfig(tier, model)];
    }),
  ) as Record<ModelTier, ModelConfig>;
}

export async function getResolvedModelTiers(
  force = false,
): Promise<Record<ModelTier, ModelConfig>> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.tiers;
  }

  if (inflight) return inflight;

  inflight = resolveFromGateway()
    .then((tiers) => {
      cache = { tiers, fetchedAt: Date.now() };
      return tiers;
    })
    .catch(() => {
      const tiers = buildStaticTiers();
      cache = { tiers, fetchedAt: Date.now() };
      return tiers;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export async function resolveModelTier(tier: ModelTier): Promise<ModelConfig> {
  const tiers = await getResolvedModelTiers();
  return tiers[tier];
}
