export type ModelDialect =
  | "openai"
  | "anthropic"
  | "google"
  | "meta"
  | "mistral"
  | "unknown";

export function inferDialect(id: string, ownedBy?: string | null): ModelDialect {
  const owner = ownedBy?.toLowerCase() ?? "";
  const bare = id.includes("/") ? id.slice(id.indexOf("/") + 1) : id;
  const lower = bare.toLowerCase();

  if (owner.includes("anthropic") || lower.startsWith("claude")) return "anthropic";
  if (owner.includes("google") || lower.startsWith("gemini")) return "google";
  if (owner.includes("meta") || lower.startsWith("llama")) return "meta";
  if (owner.includes("mistral") || lower.startsWith("mistral") || lower.startsWith("codestral")) {
    return "mistral";
  }
  if (
    owner.includes("openai") ||
    lower.startsWith("gpt") ||
    lower.startsWith("o") ||
    lower.startsWith("text-embedding")
  ) {
    return "openai";
  }

  return "unknown";
}
