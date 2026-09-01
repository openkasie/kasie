import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAppSlug, toPipedreamAppSlug } from "./app-slug.ts";

test("normalizeAppSlug converts hyphenated legacy slugs", () => {
  assert.equal(normalizeAppSlug("google-sheets"), "google_sheets");
  assert.equal(normalizeAppSlug("github"), "github");
});

test("toPipedreamAppSlug aliases normalizeAppSlug", () => {
  assert.equal(toPipedreamAppSlug("google-sheets"), "google_sheets");
});
