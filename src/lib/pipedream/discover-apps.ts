import type { App } from "@pipedream/sdk";
import { createLogger } from "@/lib/log";
import { hasPipedream } from "@/lib/env";
import type { IntegrationApp } from "@/lib/integrations/types";
import { getPipedreamClient } from "./client";

const log = createLogger("pipedream-apps");
const CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 60;

export type { IntegrationApp };

type CacheEntry = { apps: IntegrationApp[]; expiresAt: number };
const listCache = new Map<string, CacheEntry>();
const appCache = new Map<string, { app: IntegrationApp; expiresAt: number }>();

function normalizeSlug(slug: string): string {
  return slug.replace(/-/g, "_");
}

function mapApp(app: App): IntegrationApp {
  return {
    slug: app.nameSlug,
    label: app.name,
    description: app.description?.trim() || `Connect ${app.name}`,
    imgSrc: app.imgSrc,
  };
}

function listCacheKey(input: { q?: string; limit: number }) {
  return input.q ? `q:${input.q}:${input.limit}` : `featured:${input.limit}`;
}

export async function listDiscoveredIntegrationApps(input?: {
  q?: string;
  limit?: number;
}): Promise<IntegrationApp[]> {
  if (!hasPipedream()) return [];

  const limit = input?.limit ?? DEFAULT_LIMIT;
  const q = input?.q?.trim();
  const cacheKey = listCacheKey({ q, limit });

  if (!q) {
    const cached = listCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.apps;
  }

  try {
    const client = getPipedreamClient();
    const page = await client.apps.list({
      q: q || undefined,
      limit,
      sortKey: q ? undefined : "featured_weight",
      sortDirection: q ? undefined : "desc",
    });

    const apps: IntegrationApp[] = [];
    for await (const app of page) {
      apps.push(mapApp(app));
      if (apps.length >= limit) break;
    }

    if (!q) {
      listCache.set(cacheKey, { apps, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return apps;
  } catch (err) {
    log.error("app discovery list failed", { q, limit }, err);
    return [];
  }
}

export async function getDiscoveredIntegrationApp(slug: string): Promise<IntegrationApp | null> {
  if (!hasPipedream()) return null;

  const normalized = normalizeSlug(slug);
  const cached = appCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.app;

  try {
    const client = getPipedreamClient();
    const response = await client.apps.retrieve(normalized);
    const body = response as unknown as { data?: App };
    const app = body.data ?? (response as unknown as App);
    if (!app?.nameSlug) return null;

    const mapped = mapApp(app);
    appCache.set(normalized, { app: mapped, expiresAt: Date.now() + CACHE_TTL_MS });
    return mapped;
  } catch (err) {
    log.debug("app discovery retrieve failed", {
      slug: normalized,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
