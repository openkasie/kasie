import type { ModelTierSpec } from "@/design-system";
import type { ModelTier } from "@/lib/ai/types";

export type ModelTierPreset = {
  tier: ModelTier;
  label: string;
  description: string;
  specs: ModelTierSpec;
  recommended?: boolean;
};

export const INSTRUCTIONS_MAX = 4000;

export const INSTRUCTION_EXAMPLES = [
  "Always cite sources when referencing external data.",
  "Prefer concise bullet points for status updates.",
  "Our team uses UTC for all scheduling references.",
].join("\n");
