import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExplorationMission,
  buildExplorationSystem,
  buildSynthesisAugment,
  DISCOVERY_LABEL,
} from "./discovery-strategies.ts";
import type { McpToolDescriptor } from "../mcp/gateway.ts";

function tool(name: string, description = "", classification: "read" | "write" = "read"): McpToolDescriptor {
  return {
    name,
    description,
    classification,
    appSlug: "test",
    integrationId: "00000000-0000-0000-0000-000000000001",
  };
}

const integration = { nickname: "Test account", appSlug: "some_app" };

test("buildExplorationSystem embeds tool catalog and forbids per-app hardcoding", () => {
  const system = buildExplorationSystem(integration, [
    tool("some_app-run-query", "Execute a read-only SELECT against the database"),
  ]);
  assert.match(system, /some_app-run-query/);
  assert.match(system, /does not hardcode per-app behavior/i);
  assert.match(system, /Infer what a \*deep dive\* means/i);
});

test("buildExplorationSystem includes domain inference examples not slug routing", () => {
  const system = buildExplorationSystem(integration, [
    tool("app-list-repos", "List repositories"),
    tool("app-run-sql", "Run SQL query"),
  ]);
  assert.match(system, /SQL \/ schema/i);
  assert.match(system, /Repo \/ code/i);
  assert.doesNotMatch(system, /GITHUB_STRATEGY|DATABASE_STRATEGY|resolveDiscoveryStrategy/i);
});

test("buildExplorationMission references tool count not app slug heuristics", () => {
  const mission = buildExplorationMission(integration, [
    tool("a", "desc"),
    tool("b", "desc"),
  ]);
  assert.match(mission, /2 tools/);
  assert.match(mission, /Infer what domain-appropriate analysis means/i);
});

test("buildSynthesisAugment is catalog-aware and prompt-driven", () => {
  const augment = buildSynthesisAugment([
    tool("read-one", "x"),
    tool("write-one", "y", "write"),
  ]);
  assert.match(augment, /prompt-driven/i);
  assert.match(augment, /2 tools \(1 read/i);
  assert.match(augment, /Never include a 'try asking me'/i);
});

test("DISCOVERY_LABEL is stable", () => {
  assert.equal(DISCOVERY_LABEL, "Prompt-driven deep dive");
});
