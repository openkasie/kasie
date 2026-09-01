const WRITE_PATTERN =
  /\b(create|update|delete|remove|send|post|put|patch|add|insert|upload|publish|deploy|merge|close|open|approve|reject|cancel|trigger|run|execute|write|set|enable|disable|archive|invite|revoke)\b/i;

const READ_PATTERN =
  /\b(list|get|search|find|retrieve|query|fetch|read|show|describe|lookup|count|summarize|export)\b/i;

export function classifyTool(name: string): "read" | "write" {
  const normalized = name.toLowerCase().replace(/-/g, "_");
  if (READ_PATTERN.test(normalized) && !WRITE_PATTERN.test(normalized)) {
    return "read";
  }
  if (WRITE_PATTERN.test(normalized)) return "write";
  return "read";
}
