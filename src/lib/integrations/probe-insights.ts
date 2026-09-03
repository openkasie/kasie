type Triple = { entity: string; relation: string; target: string };

type ProbeRecord = {
  toolName: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

const MAX_ITEMS = 12;

const GARBAGE_PATTERNS = [
  /error parsing arguments/i,
  /console\.log/,
  /\bblocked:\s*write tool/i,
];

const SKIP_RELATIONS = new Set([
  "connected_via",
  "tool_count",
  "can_read_via",
  "can_modify_via",
  "probed_via",
  "has_additional_tools",
  "has_content_count",
  "returned_text_prefix",
  "has_content",
  "has_item",
  "has_row",
  "has_text",
]);

/** Keys that usually hold MCP transport wrappers, not domain data. */
const SKIP_ARRAY_KEYS = new Set(["content", "text", "messages", "parts"]);

function looksLikeJson(value: string): boolean {
  const t = value.trim();
  if (t.length < 2) return false;
  if (/^\d+$/.test(t)) return false;
  if (t.startsWith("{") || t.startsWith("[") || t.startsWith('{"')) return true;
  if (/"type"\s*:\s*"text"/.test(t)) return true;
  if (/\\n/.test(t) && /[\[{]/.test(t)) return true;
  return false;
}

/** Reject tool payloads that are errors or Pipedream/runtime artifacts, not account data. */
export function isMeaningfulProbeResult(result: unknown): boolean {
  if (result == null) return false;

  if (typeof result === "object" && !Array.isArray(result)) {
    const root = result as Record<string, unknown>;
    if (typeof root.error === "string" && root.error.length > 0) return false;
    if (root.blocked === true) return false;
  }

  const raw = typeof result === "string" ? result : JSON.stringify(result);
  if (raw.length < 2) return false;
  return !GARBAGE_PATTERNS.some((re) => re.test(raw));
}

export function isDisplayableTriple(triple: Triple): boolean {
  if (SKIP_RELATIONS.has(triple.relation)) return false;
  if (triple.target.length > 160) return false;
  if (looksLikeJson(triple.target)) return false;
  if (GARBAGE_PATTERNS.some((re) => re.test(triple.target))) return false;
  return true;
}

function labelForItem(item: Record<string, unknown>): string | null {
  if (item.type === "text" && typeof item.text === "string") return null;

  const name =
    item.name ??
    item.label ??
    item.title ??
    item.display_name ??
    item.displayName ??
    item.slug;
  const id = item.id ?? item.value ?? item.key;
  if (typeof name === "string" && typeof id === "string" && name !== id) {
    const label = `${name} (${shortId(id)})`;
    return looksLikeJson(label) ? null : label;
  }
  if (typeof name === "string" && !looksLikeJson(name)) return name;
  if (typeof id === "string" && id.length > 0) {
    const label = shortId(id);
    return looksLikeJson(label) ? null : label;
  }
  return null;
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  if (/^[0-9a-f-]{36}$/i.test(id)) return `${id.slice(0, 8)}…`;
  return id.length > 40 ? `${id.slice(0, 40)}…` : id;
}

function relationForKey(key: string): string {
  const normalized = key.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  if (normalized.endsWith("ies")) return `has_${normalized.slice(0, -3)}y`;
  if (normalized.endsWith("s")) return `has_${normalized.slice(0, -1)}`;
  return `has_${normalized}`;
}

function collectFromArray(
  nickname: string,
  key: string,
  items: unknown[],
  triples: Triple[],
  seen: Set<string>,
) {
  if (SKIP_ARRAY_KEYS.has(key)) return;
  if (items.length === 0) return;

  const countKey = `${nickname}|count|${key}|${items.length}`;
  if (!seen.has(countKey)) {
    seen.add(countKey);
    triples.push({
      entity: nickname,
      relation: `${relationForKey(key)}_count`,
      target: String(items.length),
    });
  }

  for (const item of items.slice(0, MAX_ITEMS)) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const label = labelForItem(record);
    if (!label) continue;
    const dedupe = `${nickname}|${key}|${label}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    triples.push({
      entity: nickname,
      relation: relationForKey(key),
      target: label,
    });
  }
}

function walkResult(nickname: string, value: unknown, triples: Triple[], seen: Set<string>) {
  if (!isMeaningfulProbeResult(value)) return;

  if (Array.isArray(value)) {
    collectFromArray(nickname, "item", value, triples, seen);
    collectSchemaRows(nickname, value, triples, seen);
    return;
  }

  if (typeof value !== "object") return;

  const root = value as Record<string, unknown>;

  if (Array.isArray(root.rows)) {
    collectSchemaRows(nickname, root.rows, triples, seen);
  }
  if (Array.isArray(root.options)) {
    collectFromArray(nickname, "option", root.options, triples, seen);
  }

  for (const [key, nested] of Object.entries(root)) {
    if (SKIP_ARRAY_KEYS.has(key)) continue;
    if (!Array.isArray(nested) || nested.length === 0) continue;
    if (typeof nested[0] !== "object" || nested[0] === null) continue;
    if (key === "rows" || key === "data" || key === "results") {
      collectSchemaRows(nickname, nested, triples, seen);
      continue;
    }
    collectFromArray(nickname, key, nested, triples, seen);
  }
}

function collectSchemaRows(
  nickname: string,
  rows: unknown[],
  triples: Triple[],
  seen: Set<string>,
) {
  for (const row of rows.slice(0, MAX_ITEMS)) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as Record<string, unknown>;

    const tableName = record.table_name ?? record.tableName ?? record.tablename;
    const schemaName = record.table_schema ?? record.tableSchema ?? record.schema;
    const columnName = record.column_name ?? record.columnName;
    const rowCount = record.row_count ?? record.rowCount ?? record.estimated_rows;

    if (typeof tableName === "string") {
      const schema = typeof schemaName === "string" ? `${schemaName}.` : "";
      const label = `${schema}${tableName}`;
      const key = `${nickname}|table|${label}`;
      if (!seen.has(key)) {
        seen.add(key);
        triples.push({ entity: nickname, relation: "has_table", target: label });
      }
    }

    if (typeof columnName === "string" && typeof tableName === "string") {
      const col = `${tableName}.${columnName}`;
      const key = `${nickname}|column|${col}`;
      if (!seen.has(key)) {
        seen.add(key);
        triples.push({ entity: nickname, relation: "has_column", target: col });
      }
    }

    if (rowCount != null && typeof tableName === "string") {
      const key = `${nickname}|rows|${tableName}|${rowCount}`;
      if (!seen.has(key)) {
        seen.add(key);
        triples.push({
          entity: nickname,
          relation: "table_row_count",
          target: `${tableName}: ${rowCount}`,
        });
      }
    }
  }
}

/** Derive knowledge-graph triples from successful probe payloads without AI. */
export function extractProbeInsights(nickname: string, probes: ProbeRecord[]): Triple[] {
  const triples: Triple[] = [];
  const seen = new Set<string>();

  for (const probe of probes) {
    if (!probe.ok || probe.result == null) continue;
    const normalized = normalizeProbeResult(probe.result);
    if (!isMeaningfulProbeResult(normalized)) continue;
    walkResult(nickname, normalized, triples, seen);
  }

  return triples.filter(isDisplayableTriple).slice(0, 40);
}

export function summarizeProbesForPrompt(
  probes: ProbeRecord[],
): { toolName: string; ok: boolean; summary: string; error?: string }[] {
  return probes
    .filter((probe) => probe.ok && probe.result != null)
    .map((probe) => {
      const normalized = normalizeProbeResult(probe.result);
      if (!isMeaningfulProbeResult(normalized)) {
        return { toolName: probe.toolName, ok: false, summary: "no extractable facts", error: "filtered" };
      }
      const insights = extractProbeInsights("_", [{ ...probe, result: normalized }]);
      if (insights.length > 0) {
        const facts = insights
          .slice(0, 8)
          .map((t) => `${t.relation}=${t.target}`)
          .join("; ");
        return { toolName: probe.toolName, ok: true, summary: facts };
      }
      return { toolName: probe.toolName, ok: true, summary: "(structured result omitted)" };
    });
}

export function accountFactsOnly(triples: Triple[]): Triple[] {
  return triples.filter(isDisplayableTriple);
}

const RELATION_LABELS: Record<string, (target: string) => string> = {
  has_table: (t) => `Table ${t}`,
  table_row_count: (t) => `${t.replace(":", " —")} rows`,
  has_column: (t) => `Column ${t}`,
  has_organization: (t) => `Organization ${t}`,
  has_project: (t) => `Project ${t}`,
  has_option: (t) => t,
  schema_inventory: (t) => t,
  notable_table: (t) => `Notable table: ${t}`,
  discovery_summary: (t) => t,
};

/** Plain-language bullets for Slack copy — no JSON, no raw relations. */
export function formatHumanFacts(facts: Triple[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const fact of facts) {
    if (!isDisplayableTriple(fact)) continue;
    const format = RELATION_LABELS[fact.relation];
    const line = format ? format(fact.target) : humanizeRelation(fact.relation, fact.target);
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }

  return lines;
}

function parseEmbeddedJson(text: string): unknown {
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return trimmed;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

/** Unwrap MCP / Pipedream response envelopes to the payload we can extract facts from. */
export function normalizeProbeResult(result: unknown): unknown {
  if (result == null) return result;

  if (typeof result === "string") {
    return parseEmbeddedJson(result);
  }

  if (Array.isArray(result)) {
    return result.map((item) => normalizeProbeResult(item));
  }

  if (typeof result !== "object") return result;

  const root = result as Record<string, unknown>;

  if (Array.isArray(root.content)) {
    const textParts = root.content
      .map((part) => {
        if (typeof part !== "object" || part === null) return null;
        const record = part as Record<string, unknown>;
        return typeof record.text === "string" ? record.text : null;
      })
      .filter((part): part is string => part != null);

    if (textParts.length === 1) {
      return normalizeProbeResult(parseEmbeddedJson(textParts[0]!));
    }
    if (textParts.length > 1) {
      return textParts.map((part) => normalizeProbeResult(parseEmbeddedJson(part)));
    }
  }

  if (typeof root.text === "string") {
    return normalizeProbeResult(parseEmbeddedJson(root.text));
  }

  if (Array.isArray(root.ret) && root.ret.length > 0) {
    return root.ret;
  }

  if (Array.isArray(root.rows)) return root.rows;
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.results)) return root.results;

  return root;
}

function humanizeRelation(relation: string, target: string): string {
  const verb = relation.replace(/^has_/, "").replace(/_/g, " ");
  return `${verb}: ${target}`;
}

/** Trim agent notes for copy context — drop completion markers and code dumps. */
export function distillAgentNotes(notes: string, maxLen = 500): string {
  const lines = notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || line === "EXPLORATION_COMPLETE") return false;
      if (/has content:/i.test(line)) return false;
      if (/"type"\s*:\s*"text"/.test(line)) return false;
      if (/\\"ret\\"/.test(line) || /"ret"\s*:\s*\[/.test(line)) return false;
      if (/```/.test(line)) return false;
      if (line.length > 80 && /[\[{]/.test(line) && /["\\]/.test(line)) return false;
      return true;
    });

  const cleaned = lines
    .join(" ")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[\s\S]{60,}\}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen)}…`;
}
