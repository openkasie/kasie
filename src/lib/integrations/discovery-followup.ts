import type { McpToolDescriptor } from "@/lib/mcp/gateway";

export function buildFallbackFollowUp(input: {
  appSlug: string;
  nickname: string;
  tools: McpToolDescriptor[];
  triples: { entity: string; relation: string; target: string }[];
}): string {
  const readTools = input.tools.filter((t) => t.classification === "read").slice(0, 5);
  const writeTools = input.tools.filter((t) => t.classification === "write").slice(0, 5);
  const memoryLines = input.triples
    .slice(0, 6)
    .map((t) => `• ${t.entity} → ${t.relation} → ${t.target}`);

  const lines = [
    "*Deep dive — what I indexed and what I can do*",
    "",
    "*Indexed into team memory*",
    memoryLines.length > 0 ? memoryLines.join("\n") : "• Connection metadata saved",
    "",
    "*Available read actions*",
    readTools.length > 0
      ? readTools.map((t) => `• \`${t.name}\``).join("\n")
      : "• Listing and lookup tools for this app",
    "",
    "*Actions that need your approval*",
    writeTools.length > 0
      ? writeTools.map((t) => `• \`${t.name}\``).join("\n")
      : "• Create/update actions will appear in Approvals before they run",
    "",
    "*Try asking me*",
    `• "Summarize my ${input.appSlug} repos and recent activity"`,
    `• "What can you do with ${input.nickname}?"`,
  ];

  return lines.join("\n");
}
