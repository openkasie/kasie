import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inferDialect, type ModelDialect } from "./compat/dialect.ts";
import { resolveGatewayModelId } from "./compat/resolve.ts";

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
  ultra: ["openai/gpt-5.4-pro", "openai/gpt-5.4", "anthropic/claude-opus-4.6"],
  smart: ["openai/gpt-5.4", "anthropic/claude-sonnet-4.6", "openai/gpt-4.1"],
  balanced: ["openai/gpt-4.1-mini", "anthropic/claude-haiku-4.5"],
} as const;

const STATIC_TIER_MODELS = {
  ultra: "openai/gpt-5.4-pro",
  smart: "openai/gpt-5.4",
  balanced: "openai/gpt-4.1-mini",
} as const;

type CatalogEntry = {
  id: string;
  ownedBy: string | null;
  dialect: ModelDialect;
};

type ModelCatalog = {
  entries: CatalogEntry[];
  byId: Map<string, CatalogEntry>;
  fetchedAt: number;
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

function pickTierDefaultModels(catalog: ModelCatalog) {
  const used = new Set<string>();
  const tiers = ["ultra", "smart", "balanced"] as const;
  const result = {} as Record<(typeof tiers)[number], string>;

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

const gatewayModels = [
  { id: "openai/gpt-5.4-pro", owned_by: "openai" },
  { id: "openai/gpt-5.4", owned_by: "openai" },
  { id: "openai/gpt-4.1-mini", owned_by: "openai" },
  { id: "anthropic/claude-sonnet-4.6", owned_by: "anthropic" },
  { id: "anthropic/claude-haiku-4.5", owned_by: "anthropic" },
  { id: "text-embedding-3-small", owned_by: "openai" },
  { id: "openai/whisper-1", owned_by: "openai" },
];

function buildTestCatalog(
  models: Array<{ id: string; owned_by?: string | null }>,
): ModelCatalog {
  const entries = models.map((item) => ({
    id: item.id,
    ownedBy: item.owned_by ?? null,
    dialect: inferDialect(item.id, item.owned_by),
  }));
  const byId = new Map<string, (typeof entries)[number]>();
  for (const entry of entries) {
    byId.set(entry.id, entry);
    const bare = entry.id.includes("/")
      ? entry.id.slice(entry.id.indexOf("/") + 1)
      : entry.id;
    byId.set(bare, entry);
  }
  return { entries, byId, fetchedAt: Date.now() };
}

describe("isChatModel", () => {
  test("excludes embedding and audio models", () => {
    assert.equal(isChatModel("text-embedding-3-small"), false);
    assert.equal(isChatModel("openai/whisper-1"), false);
    assert.equal(isChatModel("openai/gpt-5.4"), true);
  });
});

describe("pickTierDefaultModels", () => {
  test("selects distinct chat models per tier from gateway catalog", () => {
    const catalog = buildTestCatalog(gatewayModels);
    const picked = pickTierDefaultModels(catalog);

    assert.equal(picked.ultra, "openai/gpt-5.4-pro");
    assert.equal(picked.smart, "openai/gpt-5.4");
    assert.equal(picked.balanced, "openai/gpt-4.1-mini");
    assert.notEqual(picked.ultra, picked.smart);
    assert.notEqual(picked.smart, picked.balanced);
  });

  test("falls back to static defaults when catalog is empty", () => {
    const picked = pickTierDefaultModels(buildTestCatalog([]));
    assert.deepEqual(picked, STATIC_TIER_MODELS);
  });
});
