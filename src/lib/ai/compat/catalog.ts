import { createLogger } from "@/lib/log";
import { env } from "@/lib/env";
import { getGatewayBaseUrl } from "./client";
import { inferDialect, type ModelDialect } from "./dialect";

const log = createLogger("ai-gateway-catalog");
const CACHE_TTL_MS = 10 * 60 * 1000;

type CatalogEntry = {
  id: string;
  ownedBy: string | null;
  dialect: ModelDialect;
};

export type ModelCatalog = {
  entries: CatalogEntry[];
  byId: Map<string, CatalogEntry>;
  fetchedAt: number;
};

type OpenAIModelsResponse = {
  data?: Array<{ id?: string; owned_by?: string | null }>;
};

let cache: ModelCatalog | null = null;
let inflight: Promise<ModelCatalog> | null = null;

function bareId(id: string): string {
  const slash = id.indexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

function buildCatalog(raw: OpenAIModelsResponse): ModelCatalog {
  const entries: CatalogEntry[] = [];
  const byId = new Map<string, CatalogEntry>();

  for (const item of raw.data ?? []) {
    if (!item.id) continue;
    const entry: CatalogEntry = {
      id: item.id,
      ownedBy: item.owned_by ?? null,
      dialect: inferDialect(item.id, item.owned_by),
    };
    entries.push(entry);
    byId.set(item.id, entry);
    byId.set(bareId(item.id), entry);
  }

  return { entries, byId, fetchedAt: Date.now() };
}

function emptyCatalog(): ModelCatalog {
  return { entries: [], byId: new Map(), fetchedAt: Date.now() };
}

function dialectBreakdown(entries: CatalogEntry[]): Record<ModelDialect, number> {
  const counts: Record<ModelDialect, number> = {
    openai: 0,
    anthropic: 0,
    google: 0,
    meta: 0,
    mistral: 0,
    unknown: 0,
  };
  for (const entry of entries) counts[entry.dialect]++;
  return counts;
}

async function fetchCatalog(): Promise<ModelCatalog> {
  if (!env.AI_GATEWAY_URL || !env.AI_GATEWAY_API_KEY) {
    return emptyCatalog();
  }

  const url = `${getGatewayBaseUrl()}/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.AI_GATEWAY_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`gateway model discovery failed: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as OpenAIModelsResponse;
  const catalog = buildCatalog(raw);
  log.info("gateway models discovered", {
    count: catalog.entries.length,
    dialects: dialectBreakdown(catalog.entries),
  });
  return catalog;
}

export async function discoverModels(force = false): Promise<ModelCatalog> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  if (inflight) return inflight;

  inflight = fetchCatalog()
    .then((catalog) => {
      cache = catalog;
      return catalog;
    })
    .catch((err) => {
      log.error("gateway model discovery failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return cache ?? emptyCatalog();
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}