import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inferDialect, type ModelDialect } from "./dialect.ts";
import { resolveEmbeddingModelId, resolveGatewayModelId } from "./resolve.ts";

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

const mockModels = [
  { id: "openai/gpt-4.1", owned_by: "openai" },
  { id: "anthropic/claude-sonnet-4.6", owned_by: "anthropic" },
  { id: "text-embedding-3-small", owned_by: "openai" },
  { id: "gpt-4.1-mini", owned_by: "openai" },
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

describe("resolveGatewayModelId", () => {
  const catalog = buildTestCatalog(mockModels);

  test("exact match on full id", () => {
    assert.equal(
      resolveGatewayModelId("openai/gpt-4.1", catalog).id,
      "openai/gpt-4.1",
    );
  });

  test("match on bare id", () => {
    assert.equal(
      resolveGatewayModelId("gpt-4.1-mini", catalog).id,
      "gpt-4.1-mini",
    );
  });

  test("suffix match for versioned claude id", () => {
    assert.equal(
      resolveGatewayModelId("claude-sonnet-4-20250514", catalog).id,
      "anthropic/claude-sonnet-4.6",
    );
  });

  test("passthrough when not in catalog", () => {
    const result = resolveGatewayModelId("nonexistent-model", catalog);
    assert.equal(result.id, "nonexistent-model");
    assert.equal(result.matched, false);
  });
});

describe("resolveEmbeddingModelId", () => {
  const catalog = buildTestCatalog(mockModels);

  test("resolves configured embedding model", () => {
    assert.equal(
      resolveEmbeddingModelId("text-embedding-3-small", catalog).id,
      "text-embedding-3-small",
    );
  });

  test("falls back to catalog embedding entry", () => {
    assert.equal(
      resolveEmbeddingModelId("missing-embed", catalog).id,
      "text-embedding-3-small",
    );
  });
});

describe("buildTestCatalog", () => {
  test("indexes by full and bare ids", () => {
    const catalog = buildTestCatalog(mockModels);
    assert.equal(catalog.entries.length, 4);
    assert.ok(catalog.byId.has("openai/gpt-4.1"));
    assert.ok(catalog.byId.has("gpt-4.1"));
    assert.equal(catalog.byId.get("gpt-4.1")?.id, "openai/gpt-4.1");
  });
});
