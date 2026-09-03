type Triple = { entity: string; relation: string; target: string };

const GARBAGE_LINE_PATTERNS = [
  /has content:/i,
  /"type"\s*:\s*"text"/i,
  /\\"type\\"/,
  /\\"ret\\"/,
  /"os"\s*:\s*\[/,
  /"ret"\s*:\s*\[/,
  /table_sche/i,
  /\\n/,
  /\{"type":/,
  /\bblocked:\s*write tool/i,
];

function looksLikeJson(value: string): boolean {
  const t = value.trim();
  if (t.length < 2) return false;
  if (/^\d+$/.test(t)) return false;
  if (t.startsWith("{") || t.startsWith("[") || t.startsWith('{"')) return true;
  if (/"type"\s*:\s*"text"/.test(t)) return true;
  if (/\\n/.test(t) && /[\[{]/.test(t)) return true;
  return false;
}

export function isGarbageCopyLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (GARBAGE_LINE_PATTERNS.some((re) => re.test(trimmed))) return true;
  if (trimmed.length > 120 && looksLikeJson(trimmed)) return true;
  return false;
}

/** Plain-language bullets safe to pass into Slack copy generation. */
export function formatDiscoveryFindingsForCopy(
  humanFacts: string[],
  memories: Triple[],
): string {
  const cleanHuman = humanFacts.filter((line) => !isGarbageCopyLine(line) && !looksLikeJson(line));
  if (cleanHuman.length > 0) {
    return cleanHuman.slice(0, 8).map((line) => `• ${line}`).join("\n");
  }

  const fromMemories = memories
    .filter((m) => m.relation !== "connected_via")
    .map((m) => {
      if (m.relation === "schema_inventory") return `• ${m.target}`;
      if (m.relation === "notable_table") return `• Notable table: ${m.target}`;
      if (m.relation === "discovery_summary") return `• ${m.target}`;
      if (isGarbageCopyLine(m.target) || looksLikeJson(m.target)) return null;
      return `• ${m.target}`;
    })
    .filter((line): line is string => line != null);

  return fromMemories.slice(0, 8).join("\n");
}

/** Strip raw tool JSON and triple-style dumps from generated Slack copy. */
export function sanitizeDiscoverySlackText(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let dropSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^(\*What's in your account\*|\*What I found\*|\*Highlights\*)/i.test(trimmed)) {
      dropSection = false;
      kept.push(line);
      continue;
    }

    if (isGarbageCopyLine(line)) {
      dropSection = true;
      continue;
    }

    if (dropSection && trimmed.startsWith("•")) continue;
    if (dropSection && trimmed.length > 0 && !trimmed.startsWith("*")) {
      dropSection = false;
    }

    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isLowQualityDiscoveryCopy(text: string): boolean {
  if (text.length < 40) return true;
  const garbageLines = text.split("\n").filter((line) => isGarbageCopyLine(line));
  return garbageLines.length > 0;
}
