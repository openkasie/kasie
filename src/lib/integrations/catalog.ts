import {
  getDiscoveredIntegrationApp,
  listDiscoveredIntegrationApps,
} from "@/lib/pipedream/discover-apps";
import { normalizeAppSlug } from "@/lib/pipedream/app-slug";
import type { IntegrationApp } from "@/lib/integrations/types";

export type { IntegrationApp };

export { normalizeAppSlug };

export function defaultIntegrationNickname(appLabel: string, index: number) {
  if (index <= 1) return `${appLabel} account`;
  return `${appLabel} account ${index}`;
}
export async function getIntegrationApp(slug: string): Promise<IntegrationApp | null> {
  return getDiscoveredIntegrationApp(slug);
}

/** Featured/search results plus metadata for connected apps not in the current result set. */
export async function listIntegrationCatalog(input: {
  connectedSlugs: string[];
  q?: string;
  limit?: number;
}): Promise<IntegrationApp[]> {
  const limit = input.limit ?? 60;
  const discovered = await listDiscoveredIntegrationApps({ q: input.q, limit });
  const bySlug = new Map<string, IntegrationApp>();

  for (const app of discovered) {
    bySlug.set(normalizeAppSlug(app.slug), app);
  }

  const missing = input.connectedSlugs.filter(
    (slug) => !bySlug.has(normalizeAppSlug(slug)),
  );

  if (missing.length > 0) {
    const extras = await Promise.all(missing.map((slug) => getDiscoveredIntegrationApp(slug)));
    for (const app of extras) {
      if (app) bySlug.set(normalizeAppSlug(app.slug), app);
    }
  }

  const ordered: IntegrationApp[] = [];
  const seen = new Set<string>();

  for (const app of discovered) {
    const key = normalizeAppSlug(app.slug);
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(app);
  }

  for (const slug of input.connectedSlugs) {
    const key = normalizeAppSlug(slug);
    const app = bySlug.get(key);
    if (!app || seen.has(key)) continue;
    seen.add(key);
    ordered.push(app);
  }

  return ordered;
}
