import test from "node:test";
import assert from "node:assert/strict";
import { extractConfigureHints, planProbeSteps, resolveProbeArgs, type ProbeTool } from "./probe-planner.ts";
import {
  extractProbeInsights,
  formatHumanFacts,
  isMeaningfulProbeResult,
  summarizeProbesForPrompt,
} from "./probe-insights.ts";

function tool(partial: Partial<ProbeTool> & Pick<ProbeTool, "name">): ProbeTool {
  return {
    description: partial.name,
    classification: "read",
    ...partial,
  };
}

const NEON_TOOLS: ProbeTool[] = [
  tool({
    name: "neon_api_keys-list-organizations",
    readOnlyHint: true,
    inputSchema: { type: "object", properties: {}, required: [] },
  }),
  tool({
    name: "neon_api_keys-list-project-id-options",
    description: "Dropdown to select a project id option",
    inputSchema: {
      type: "object",
      properties: { org_id: { type: "string" } },
      required: ["org_id"],
    },
  }),
  tool({
    name: "neon_api_keys-list-projects",
    readOnlyHint: true,
    inputSchema: {
      type: "object",
      properties: { org_id: { type: "string" } },
      required: ["org_id"],
    },
  }),
  tool({
    name: "neon_api_keys-create-project",
    classification: "write",
    destructiveHint: false,
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  }),
];

const NEON_ACTION_ONLY: ProbeTool[] = [
  tool({
    name: "neon_api_keys-list-project-id-options",
    description: "Dropdown to select a project id option",
    inputSchema: {
      type: "object",
      properties: { org_id: { type: "string" } },
      required: ["org_id"],
    },
  }),
  tool({
    name: "neon_api_keys-create-project",
    classification: "write",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  }),
  tool({
    name: "neon_api_keys-create-database",
    classification: "write",
    inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] },
  }),
  tool({
    name: "retrieve_options",
    description: "Retrieve dynamic prop options",
    inputSchema: { type: "object", properties: {}, required: [] },
  }),
];

test("schema-driven plan probes orgs then projects with org_id", () => {
  const steps = planProbeSteps(NEON_TOOLS);
  assert.equal(steps[0]?.toolName, "neon_api_keys-list-organizations");

  const projectStep = steps.find((s) => s.toolName === "neon_api_keys-list-projects");
  assert.ok(projectStep);

  const projectArgs = resolveProbeArgs(projectStep!, {
    results: [
      {
        toolName: "neon_api_keys-list-organizations",
        ok: true,
        result: { organizations: [{ id: "org-123", name: "Acme" }] },
      },
    ],
  });
  assert.deepEqual(projectArgs, { org_id: "org-123" });
});

test("action-only catalog falls back to retrieve_options and config helpers", () => {
  const steps = planProbeSteps(NEON_ACTION_ONLY);
  assert.ok(steps.some((s) => s.toolName === "retrieve_options"));
  assert.ok(steps.some((s) => s.toolName === "neon_api_keys-list-project-id-options"));
});

test("schema-driven plan skips config helper tools in full catalogs", () => {
  const steps = planProbeSteps([
    tool({
      name: "app-list-widget-id-options",
      inputSchema: {
        type: "object",
        properties: { org_id: { type: "string" } },
        required: ["org_id"],
      },
    }),
    tool({
      name: "app-list-widgets",
      inputSchema: { type: "object", properties: {}, required: [] },
    }),
  ]);

  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.toolName, "app-list-widgets");
});

test("schema-driven plan skips tools when required args are unavailable", () => {
  const steps = planProbeSteps([
    tool({
      name: "app-list-things",
      inputSchema: {
        type: "object",
        properties: { org_id: { type: "string" } },
        required: ["org_id"],
      },
    }),
  ]);

  assert.equal(steps.length, 1);
  assert.equal(resolveProbeArgs(steps[0]!, { results: [] }), null);
});

test("schema-driven plan prefers readOnlyHint tools first", () => {
  const steps = planProbeSteps([
    tool({
      name: "app-get-current-user",
      readOnlyHint: true,
      inputSchema: { type: "object", properties: {}, required: [] },
    }),
    tool({
      name: "app-list-items",
      inputSchema: { type: "object", properties: {}, required: [] },
    }),
  ]);

  assert.equal(steps[0]?.toolName, "app-get-current-user");
});

test("extractConfigureHints parses prop hints from tool descriptions", () => {
  const hints = extractConfigureHints([
    tool({
      name: "neon_api_keys-create-project",
      description:
        'Create a project. Use "CONFIGURE_COMPONENT" with key: neon_api_keys-create-project, propName: org_id',
    }),
  ]);

  assert.equal(hints.length, 1);
  assert.deepEqual(hints[0], {
    key: "neon_api_keys-create-project",
    propName: "org_id",
  });
});

test("extractProbeInsights builds triples from list payloads", () => {
  const triples = extractProbeInsights("Neon account", [
    {
      toolName: "neon_api_keys-list-organizations",
      ok: true,
      result: {
        organizations: [
          { id: "org-1", name: "Acme" },
          { id: "org-2", name: "Beta" },
        ],
      },
    },
  ]);

  assert.ok(triples.some((t) => t.relation === "has_organization" && t.target.includes("Acme")));
  assert.ok(triples.some((t) => t.relation === "has_organization_count" && t.target === "2"));
});

test("isMeaningfulProbeResult rejects parse errors and runtime artifacts", () => {
  assert.equal(isMeaningfulProbeResult("Error parsing arguments"), false);
  assert.equal(isMeaningfulProbeResult({ os: [{ k: "console.log" }] }), false);
  assert.equal(isMeaningfulProbeResult({ organizations: [{ id: "org-1", name: "Acme" }] }), true);
});

test("formatHumanFacts skips JSON blobs and formats tables", () => {
  const facts = formatHumanFacts([
    { entity: "DB", relation: "has_table", target: "public.users" },
    { entity: "DB", relation: "has_content", target: '{"type":"text","text":"{\\"os\\":[]}"}' },
    { entity: "DB", relation: "table_row_count", target: "kasie_memories: 39" },
  ]);
  assert.ok(facts.some((f) => f.includes("public.users")));
  assert.ok(facts.some((f) => f.includes("kasie_memories")));
  assert.equal(facts.some((f) => f.includes('"type"')), false);
});

test("summarizeProbesForPrompt compresses successful probe facts", () => {
  const summary = summarizeProbesForPrompt([
    {
      toolName: "neon_api_keys-list-organizations",
      ok: true,
      result: { organizations: [{ id: "org-1", name: "Acme" }] },
    },
  ]);

  assert.equal(summary.length, 1);
  assert.match(summary[0]!.summary, /has_organization/);
});
