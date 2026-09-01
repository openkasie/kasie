/** Pipedream Connect uses underscore name slugs (e.g. google_sheets). */
export function normalizeAppSlug(slug: string): string {
  return slug.replace(/-/g, "_");
}

export function toPipedreamAppSlug(slug: string): string {
  return normalizeAppSlug(slug);
}
