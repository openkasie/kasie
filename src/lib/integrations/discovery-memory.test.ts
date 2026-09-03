import test from "node:test";
import assert from "node:assert/strict";
import { buildDiscoveryMemories } from "./discovery-memory.ts";

test("buildDiscoveryMemories consolidates tables into schema_inventory", () => {
  const facts = [
    { entity: "DB", relation: "has_table", target: "public.users" },
    { entity: "DB", relation: "has_table", target: "public.orders" },
    { entity: "DB", relation: "table_row_count", target: "public.users: 100" },
    { entity: "DB", relation: "table_row_count", target: "public.orders: 5" },
    { entity: "DB", relation: "has_column", target: "users.id" },
  ];

  const memories = buildDiscoveryMemories({
    entity: "Neon Postgres account",
    appSlug: "neon_postgres",
    facts,
    humanFacts: [],
  });

  assert.ok(memories.length <= 12);
  assert.ok(memories.some((m) => m.relation === "schema_inventory"));
  assert.ok(memories.some((m) => m.relation === "connected_via"));
  assert.equal(memories.some((m) => m.relation === "has_column"), false);
  assert.equal(memories.filter((m) => m.relation === "has_table").length, 0);
});

test("buildDiscoveryMemories uses discovery_summary when no schema tables", () => {
  const memories = buildDiscoveryMemories({
    entity: "GitHub account",
    appSlug: "github",
    facts: [{ entity: "GH", relation: "has_project", target: "acme/web" }],
    humanFacts: ["Repo acme/web", "Primary language TypeScript"],
  });

  assert.ok(memories.some((m) => m.relation === "discovery_summary"));
  assert.ok(memories.length <= 12);
});

test("buildDiscoveryMemories uses narrativeSummary when facts are empty", () => {
  const memories = buildDiscoveryMemories({
    entity: "Neon Postgres account",
    appSlug: "neon_postgres",
    facts: [],
    humanFacts: [],
    narrativeSummary: "Found 20 tables in public schema. Largest: users with 100 rows.",
  });

  assert.equal(memories.length, 2);
  assert.ok(memories.some((m) => m.relation === "connected_via"));
  assert.ok(memories.some((m) => m.relation === "discovery_summary"));
});

test("buildDiscoveryMemories keeps top tables as notable_table", () => {
  const facts = Array.from({ length: 10 }, (_, i) => ({
    entity: "DB",
    relation: "table_row_count",
    target: `public.t${i}: ${100 - i}`,
  }));

  const memories = buildDiscoveryMemories({
    entity: "DB",
    appSlug: "neon_postgres",
    facts,
    humanFacts: [],
  });

  const notable = memories.filter((m) => m.relation === "notable_table");
  assert.equal(notable.length, 3);
  assert.match(notable[0]!.target, /t0/);
});
