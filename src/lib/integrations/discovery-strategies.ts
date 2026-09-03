import type { McpToolDescriptor } from "@/lib/mcp/gateway";

/** Exploration budget — same for every integration; depth comes from prompts, not per-app code. */
export const DISCOVERY_EXPLORATION_ROUNDS = 4;
export const DISCOVERY_STEPS_PER_ROUND = 12;

export const DISCOVERY_CONTINUE_PROMPT = [
  "Continue the deep dive using the updated tool catalog.",
  "Chain any IDs or config props you discovered into dependent read tools.",
  "Findings are saved to team memory automatically when discovery finishes — focus on exploration, not memo calls.",
  "Say EXPLORATION_COMPLETE only when you have analyzed the account to the fullest depth these tools allow.",
].join(" ");

function formatToolCatalog(tools: McpToolDescriptor[]): string {
  if (tools.length === 0) return "(no tools returned for this connection)";

  const readTools = tools.filter((t) => t.classification === "read");
  const writeTools = tools.filter((t) => t.classification === "write");

  const lines: string[] = [`${tools.length} tools exposed by Pipedream MCP:`];

  if (readTools.length > 0) {
    lines.push("", `Read / config tools (${readTools.length}):`);
    for (const t of readTools) {
      lines.push(`- ${t.name}: ${t.description.slice(0, 220)}`);
    }
  }

  if (writeTools.length > 0) {
    lines.push("", `Write tools (${writeTools.length}, blocked during discovery):`);
    for (const t of writeTools.slice(0, 15)) {
      lines.push(`- ${t.name}: ${t.description.slice(0, 120)}`);
    }
    if (writeTools.length > 15) {
      lines.push(`- … and ${writeTools.length - 15} more write tools`);
    }
  }

  return lines.join("\n");
}

/**
 * Prompt-driven discovery — no per-integration behavioral code.
 * The model infers domain and deep-dive plan from the live tool catalog.
 */
export function buildExplorationSystem(
  integration: { nickname: string; appSlug: string },
  tools: McpToolDescriptor[],
): string {
  const catalog = formatToolCatalog(tools);

  return [
    `You are performing post-connect discovery for "${integration.nickname}" (${integration.appSlug}).`,
    "",
    "Infer what a *deep dive* means from the tool catalog below — Pipedream exposes 2,000+ apps and Kasie does not hardcode per-app behavior.",
    "Read tool names and descriptions to determine the domain (database, codebase, CRM, messaging, analytics, etc.) and what analysis is possible.",
    "",
    "Mission: execute the deepest account analysis these read/config tools support — inventory resources, sample data, read contents, compute quick metrics.",
    "NOT the mission: listing tool names, narrating probe errors, or telling the operator to ask you later.",
    "",
    "How to infer depth from the catalog (examples — pick what matches, combine as needed):",
    "- SQL / schema / table / query tools → enumerate schemas, sample rows, row counts, column types",
    "- Repo / code / file / content tools → list repos or projects, read READMEs and configs, skim structure",
    "- Ticket / issue / deal / contact tools → inventory records, pipelines, recent items",
    "- Channel / message tools → list channels, recent activity patterns (never send during discovery)",
    "- Generic list/get/describe tools → chain IDs and config props to reach nested resources",
    "",
    "Tool catalog:",
    catalog,
    "",
    "Exploration rules:",
    "- Derive your analysis plan from the catalog — do not wait for app-specific instructions",
    "- Read each tool description; use exact parameter names and CONFIGURE_COMPONENT hints (key + propName)",
    "- Chain parent IDs before dependent list/config tools",
    "- After configuration or *-options tools, call reload_integration_tools then use newly exposed tools",
    "- Findings are persisted automatically after discovery — do not call remember or other memory tools",
    "- Never call create, send, delete, or mutating tools during discovery",
    "- Complete the analysis yourself — never suggest prompts the operator should run later",
    "- In your written notes, use plain English only — never paste raw tool JSON, MCP wrappers, or triple-style dumps (no has_content lines)",
    "",
    "When the deepest reachable analysis is done, end with EXPLORATION_COMPLETE on its own line.",
  ].join("\n");
}

export function buildExplorationMission(
  integration: { nickname: string; appSlug: string },
  tools: McpToolDescriptor[],
): string {
  return [
    `Deep dive into my connected ${integration.appSlug} account ("${integration.nickname}").`,
    "",
    `You have ${tools.length} tools available. Infer what domain-appropriate analysis means from their names and descriptions, then execute it fully.`,
    "Go beyond connection metadata — analyze what's actually in the account (data, repos, records, resources).",
    "Complete the full analysis now — key findings will be saved to team memory when you finish.",
  ].join("\n");
}

export function buildSynthesisAugment(tools: McpToolDescriptor[]): string {
  const readCount = tools.filter((t) => t.classification === "read").length;
  return [
    "Discovery was prompt-driven from the Pipedream tool catalog — no app-specific code path.",
    `Catalog had ${tools.length} tools (${readCount} read/config).`,
    "Report what was actually analyzed and found. Do NOT suggest the user ask you to explore later.",
    "Never include a 'try asking me' section.",
  ].join("\n");
}

/** Stable label for logs and reports — not a strategy enum. */
export const DISCOVERY_LABEL = "Prompt-driven deep dive";
