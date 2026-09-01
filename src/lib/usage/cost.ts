import type { ModelTier } from "@/lib/ai/types";

// List-price estimates in USD micros per 1M tokens (input / output).
const MICROS_PER_MILLION: Record<ModelTier, { input: number; output: number }> = {
  balanced: { input: 150_000, output: 600_000 },
  smart: { input: 2_500_000, output: 10_000_000 },
  ultra: { input: 3_000_000, output: 15_000_000 },
};

export const USD_MICROS = 1_000_000;
export const CENTS_TO_MICROS = 10_000;

export function computeRunCostMicros(
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = MICROS_PER_MILLION[tier];
  return Math.ceil(
    (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000,
  );
}

export function utcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
