import type { ModelCatalog } from "./catalog";

function bareId(id: string): string {
  const slash = id.indexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

function modelFamily(id: string): string {
  let bare = bareId(id).toLowerCase();
  bare = bare.replace(/-\d{8}$/, "");
  const dot = bare.lastIndexOf(".");
  if (dot > 0) bare = bare.slice(0, dot);
  return bare;
}

function suffixMatch(configured: string, catalogId: string): boolean {
  const bare = bareId(configured).toLowerCase();
  const catalogBare = bareId(catalogId).toLowerCase();
  return (
    catalogBare === bare ||
    catalogBare.startsWith(`${bare}-`) ||
    catalogBare.startsWith(`${bare}.`) ||
    bare.startsWith(`${catalogBare}-`) ||
    bare.startsWith(`${catalogBare}.`) ||
    modelFamily(configured) === modelFamily(catalogId)
  );
}

export type ResolveResult = {
  id: string;
  matched: boolean;
};

export function resolveGatewayModelId(
  configuredId: string,
  catalog: ModelCatalog,
): ResolveResult {
  const exact = catalog.byId.get(configuredId);
  if (exact) return { id: exact.id, matched: true };

  const bare = bareId(configuredId);
  const bareMatch = catalog.byId.get(bare);
  if (bareMatch) return { id: bareMatch.id, matched: true };

  for (const entry of catalog.entries) {
    if (suffixMatch(configuredId, entry.id)) return { id: entry.id, matched: true };
  }

  return { id: configuredId, matched: false };
}

export function resolveEmbeddingModelId(
  configuredId: string,
  catalog: ModelCatalog,
): ResolveResult {
  const resolved = resolveGatewayModelId(configuredId, catalog);
  if (resolved.matched) return resolved;

  const embedding = catalog.entries.find((e) =>
    e.id.toLowerCase().includes("embed"),
  );
  if (embedding) return { id: embedding.id, matched: true };

  return { id: configuredId, matched: false };
}
