import type { ModelCatalog } from "./compat/catalog";
import { resolveGatewayModelId } from "./compat/resolve";

const CHAT_MODEL_BLOCKLIST = [
  "embed",
  "embedding",
  "tts",
  "whisper",
  "dall-e",
  "dalle",
  "imagen",
  "moderation",
  "realtime",
  "transcribe",
  "audio",
  "sora",
  "speech",
] as const;

const TIER_MODEL_PREFERENCES = {
  ultra: [
    "openai/gpt-5.4-pro",
    "openai/gpt-5.4",
    "anthropic/claude-opus-4.6",
  ],
  smart: [
    "openai/gpt-5.4",
    "anthropic/claude-sonnet-4.6",
    "openai/gpt-4.1",
    "anthropic/claude-sonnet-4",
    "google/gemini-3-flash",
  ],
  balanced: [
    "openai/gpt-4.1-mini",
    "anthropic/claude-haiku-4.5",
    "google/gemini-3-flash",
    "google/gemini-2.5-flash",
    "mistral/mistral-small",
  ],
} as const;

export type PickTier = keyof typeof TIER_MODEL_PREFERENCES;

export const STATIC_TIER_MODELS: Record<PickTier, string> = {
  ultra: "openai/gpt-5.4-pro",
  smart: "openai/gpt-5.4",
  balanced: "openai/gpt-4.1-mini",
};

function isChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !CHAT_MODEL_BLOCKLIST.some((token) => lower.includes(token));
}

function pickPreference(
  preferences: readonly string[],
  catalog: ModelCatalog,
  used: Set<string>,
): string | null {
  for (const preference of preferences) {
    const resolved = resolveGatewayModelId(preference, catalog);
    if (!resolved.matched || !isChatModel(resolved.id) || used.has(resolved.id)) {
      continue;
    }
    return resolved.id;
  }
  return null;
}

function pickUnusedChatModel(catalog: ModelCatalog, used: Set<string>): string | null {
  for (const entry of catalog.entries) {
    if (!isChatModel(entry.id) || used.has(entry.id)) continue;
    return entry.id;
  }
  return null;
}

export function pickTierDefaultModels(
  catalog: ModelCatalog,
): Record<PickTier, string> {
  const used = new Set<string>();
  const tiers = ["ultra", "smart", "balanced"] as const;
  const result = {} as Record<PickTier, string>;

  for (const tier of tiers) {
    const picked =
      pickPreference(TIER_MODEL_PREFERENCES[tier], catalog, used) ??
      pickUnusedChatModel(catalog, used) ??
      STATIC_TIER_MODELS[tier];
    result[tier] = picked;
    used.add(picked);
  }

  return result;
}
