import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDiscoveryFindingsForCopy,
  isGarbageCopyLine,
  isLowQualityDiscoveryCopy,
  sanitizeDiscoverySlackText,
} from "./discovery-copy.ts";

test("isGarbageCopyLine detects MCP JSON dumps", () => {
  assert.equal(
    isGarbageCopyLine('• has content: {"type":"text","text":"{\\"os\\":[]}"}'),
    true,
  );
  assert.equal(isGarbageCopyLine("• Table public.users"), false);
});

test("formatDiscoveryFindingsForCopy prefers clean human facts", () => {
  const block = formatDiscoveryFindingsForCopy(
    ["Table public.users", "20 tables in public schema"],
    [{ entity: "DB", relation: "connected_via", target: "neon_postgres" }],
  );
  assert.match(block, /public\.users/);
  assert.doesNotMatch(block, /"type"/);
});

test("formatDiscoveryFindingsForCopy falls back to memory preview", () => {
  const block = formatDiscoveryFindingsForCopy([], [
    { entity: "DB", relation: "schema_inventory", target: "20 tables: public.users (100 rows)" },
    { entity: "DB", relation: "notable_table", target: "public.users (100 rows)" },
  ]);
  assert.match(block, /20 tables/);
  assert.match(block, /Notable table/);
});

test("sanitizeDiscoverySlackText removes garbage bullet sections", () => {
  const raw = [
    "*What I looked at*",
    "Your Neon database for Kasie.",
    "",
    "*What's in your account*",
    '• has content: {"type":"text","text":"{\\"ret\\":[]}"}',
    '• has content: {"type":"text","text":"more json"}',
    "",
    "*You're set*",
    "Ask me anytime.",
  ].join("\n");

  const cleaned = sanitizeDiscoverySlackText(raw);
  assert.doesNotMatch(cleaned, /has content/);
  assert.doesNotMatch(cleaned, /"type"/);
  assert.match(cleaned, /You're set/);
});

test("isLowQualityDiscoveryCopy flags JSON leaks", () => {
  assert.equal(
    isLowQualityDiscoveryCopy('Summary\n• {"type":"text","text":"bad"}'),
    true,
  );
  assert.equal(
    isLowQualityDiscoveryCopy("*Highlights*\n• 20 tables in public schema\n• Largest: users"),
    false,
  );
});
