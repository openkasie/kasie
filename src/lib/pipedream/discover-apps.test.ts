import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAppSlug } from "./app-slug.ts";
import type { App } from "@pipedream/sdk";

function mapApp(app: App) {
  return {
    slug: app.nameSlug,
    label: app.name,
    description: app.description?.trim() || `Connect ${app.name}`,
    imgSrc: app.imgSrc,
  };
}

test("normalizeAppSlug converts hyphenated legacy slugs", () => {
  assert.equal(normalizeAppSlug("google-sheets"), "google_sheets");
  assert.equal(normalizeAppSlug("github"), "github");
});

test("mapApp uses Pipedream name slug and description fallback", () => {
  const mapped = mapApp({
    nameSlug: "github",
    name: "GitHub",
    imgSrc: "https://example.com/github.png",
    categories: [],
    featuredWeight: 1,
    scopeProfiles: [],
  });

  assert.equal(mapped.slug, "github");
  assert.equal(mapped.label, "GitHub");
  assert.equal(mapped.description, "Connect GitHub");
});
