import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { embedText } from "@/lib/ai/compat";
import { db } from "@/lib/db/client";
import { kasieMemories } from "@/lib/db/schema";
import { hasAiProvider } from "@/lib/env";

const cache = new Map<string, number[]>();

function hashInput(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function createEmbedding(text: string): Promise<number[]> {
  const key = hashInput(text);
  const cached = cache.get(key);
  if (cached) return cached;

  if (!hasAiProvider()) {
    const stub = Array.from({ length: 1536 }, (_, i) =>
      Math.sin(i + text.length) * 0.01,
    );
    cache.set(key, stub);
    return stub;
  }

  const embedding = await embedText(text);
  cache.set(key, embedding);
  return embedding;
}

export async function storeMemoryTriple(input: {
  projectId: string;
  entity: string;
  relation: string;
  target: string;
}) {
  const text = `${input.entity} ${input.relation} ${input.target}`;
  const embedding = await createEmbedding(text);

  await db.insert(kasieMemories).values({
    projectId: input.projectId,
    entity: input.entity,
    relation: input.relation,
    target: input.target,
    embedding,
  });
}

export async function retrieveMemories(projectId: string, query: string, limit = 5) {
  const embedding = await createEmbedding(query);
  const vectorStr = `[${embedding.join(",")}]`;

  const rows = await db
    .select({
      entity: kasieMemories.entity,
      relation: kasieMemories.relation,
      target: kasieMemories.target,
    })
    .from(kasieMemories)
    .where(eq(kasieMemories.projectId, projectId))
    .orderBy(sql`${kasieMemories.embedding} <=> ${vectorStr}::vector`)
    .limit(limit);

  return rows;
}

export function formatMemoriesForPrompt(
  memories: { entity: string; relation: string; target: string }[],
): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.entity} ${m.relation} ${m.target}`);
  return `\n\nRelevant team memory:\n${lines.join("\n")}`;
}
