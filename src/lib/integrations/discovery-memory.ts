type Triple = { entity: string; relation: string; target: string };

const MAX_DISCOVERY_MEMORIES = 12;
const MAX_INVENTORY_CHARS = 900;
const MAX_TOP_TABLES = 3;

function parseRowCount(target: string): number {
  const match = target.match(/:\s*(\d+)\s*$/);
  return match ? Number.parseInt(match[1]!, 10) : 0;
}

function tableNameFromRowCount(target: string): string {
  return target.replace(/:\s*\d+\s*$/, "").trim();
}

/** Collapse granular probe facts into a small set of durable integration memories. */
export function buildDiscoveryMemories(input: {
  entity: string;
  appSlug: string;
  facts: Triple[];
  humanFacts: string[];
  /** Fallback when structured probe extraction is sparse (agent narrative or Slack report). */
  narrativeSummary?: string;
}): Triple[] {
  const out: Triple[] = [
    { entity: input.entity, relation: "connected_via", target: input.appSlug },
  ];

  const tables = input.facts.filter((f) => f.relation === "has_table");
  const rowCounts = input.facts.filter((f) => f.relation === "table_row_count");

  if (tables.length > 0 || rowCounts.length > 0) {
    const countByTable = new Map<string, number>();
    for (const rc of rowCounts) {
      countByTable.set(tableNameFromRowCount(rc.target), parseRowCount(rc.target));
    }

    const tableNames = [
      ...new Set([
        ...tables.map((t) => t.target),
        ...rowCounts.map((t) => tableNameFromRowCount(t.target)),
      ]),
    ].sort((a, b) => (countByTable.get(b) ?? 0) - (countByTable.get(a) ?? 0));

    const inventoryParts = tableNames.map((name) => {
      const count = countByTable.get(name);
      return count != null ? `${name} (${count} rows)` : name;
    });

    let inventory = inventoryParts.join(", ");
    if (inventory.length > MAX_INVENTORY_CHARS) {
      inventory = `${inventory.slice(0, MAX_INVENTORY_CHARS)}…`;
    }

    out.push({
      entity: input.entity,
      relation: "schema_inventory",
      target: `${tableNames.length} tables: ${inventory}`,
    });

    for (const name of tableNames.slice(0, MAX_TOP_TABLES)) {
      const count = countByTable.get(name);
      out.push({
        entity: input.entity,
        relation: "notable_table",
        target: count != null ? `${name} (${count} rows)` : name,
      });
    }
  } else if (input.humanFacts.length > 0) {
    out.push({
      entity: input.entity,
      relation: "discovery_summary",
      target: input.humanFacts.slice(0, 8).join("; "),
    });
  } else if (input.narrativeSummary) {
    out.push({
      entity: input.entity,
      relation: "discovery_summary",
      target: input.narrativeSummary.slice(0, 900),
    });
  }

  const skip = new Set([
    "connected_via",
    "has_table",
    "has_column",
    "table_row_count",
    "schema_inventory",
    "discovery_summary",
    "notable_table",
  ]);

  for (const fact of input.facts) {
    if (skip.has(fact.relation)) continue;
    if (fact.relation.endsWith("_count")) continue;
    if (out.length >= MAX_DISCOVERY_MEMORIES) break;
    out.push(fact);
  }

  const seen = new Set<string>();
  return out.filter((t) => {
    const key = `${t.relation}|${t.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_DISCOVERY_MEMORIES);
}

/** Relations discovery owns for replace-on-rerun cleanup. */
export const DISCOVERY_OWNED_RELATIONS = [
  "connected_via",
  "schema_inventory",
  "discovery_summary",
  "notable_table",
  "has_table",
  "has_column",
  "table_row_count",
  "has_organization",
  "has_project",
  "has_option",
  "has_item",
] as const;
