import { getResolvedModelTiers } from "@/lib/ai/model-tiers";
import type { ModelTier } from "@/lib/ai/types";
import type { ModelTierPreset } from "./preferences.constants";

export type { ModelTierPreset } from "./preferences.constants";

const TIER_META: Record<
  ModelTier,
  { label: string; description: string; estCost: string; recommended?: boolean }
> = {
  ultra: {
    label: "Ultra",
    description: "Complex reasoning and the longest tasks. Highest API cost.",
    estCost: "~2× base",
  },
  smart: {
    label: "Smart",
    description: "Everyday work with strong quality. Base rate reference tier.",
    estCost: "Base rate",
    recommended: true,
  },
  balanced: {
    label: "Balanced",
    description: "High volume, lower-stakes work at reduced cost.",
    estCost: "~50% cheaper",
  },
};

export async function buildModelTierPresets(): Promise<ModelTierPreset[]> {
  const tiers = await getResolvedModelTiers();

  return (["ultra", "smart", "balanced"] as const).map((tier) => {
    const config = tiers[tier];
    const meta = TIER_META[tier];
    return {
      tier,
      label: meta.label,
      description: meta.description,
      recommended: meta.recommended,
      specs: {
        model: config.model,
        maxOutputTokens: config.maxOutputTokens,
        estCost: meta.estCost,
      },
    };
  });
}
