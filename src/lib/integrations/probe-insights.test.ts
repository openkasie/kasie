import test from "node:test";
import assert from "node:assert/strict";
import {
  extractProbeInsights,
  isMeaningfulProbeResult,
  normalizeProbeResult,
} from "./probe-insights.ts";

test("normalizeProbeResult unwraps MCP text content", () => {
  const wrapped = {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          ret: [
            { table_schema: "public", table_name: "users", row_count: 42 },
            { table_schema: "public", table_name: "orders", row_count: 5 },
          ],
        }),
      },
    ],
  };

  const normalized = normalizeProbeResult(wrapped);
  assert.ok(Array.isArray(normalized));
  assert.equal((normalized as Record<string, unknown>[])[0]!.table_name, "users");
});

test("isMeaningfulProbeResult accepts MCP-wrapped SQL results", () => {
  const wrapped = {
    content: [{ type: "text", text: '{"ret":[{"table_name":"users"}]}' }],
  };
  const normalized = normalizeProbeResult(wrapped);
  assert.equal(isMeaningfulProbeResult(normalized), true);
});

test("extractProbeInsights extracts schema rows from Pipedream ret payload", () => {
  const probes = [
    {
      toolName: "run_sql",
      ok: true,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              os: [],
              ret: [
                { table_schema: "public", table_name: "users", row_count: 100 },
                { table_schema: "public", table_name: "orders", row_count: 5 },
              ],
            }),
          },
        ],
      },
    },
  ];

  const facts = extractProbeInsights("Neon Postgres account", probes);
  assert.ok(facts.some((f) => f.relation === "has_table" && f.target === "public.users"));
  assert.ok(facts.some((f) => f.relation === "table_row_count" && f.target.includes("users")));
});
