import { createHash } from "node:crypto";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
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

/** Topic-pass matches farther than this are noise, not context. */
export const MEMORY_RELEVANCE_MAX_DISTANCE = 0.6;

/** Same entity+relation with a target this close is the same fact restated. */
export const MEMORY_DEDUP_MAX_DISTANCE = 0.15;

export async function storeMemoryTriple(input: {
  projectId: string;
  entity: string;
  relation: string;
  target: string;
}) {
  const text = `${input.entity} ${input.relation} ${input.target}`;
  const embedding = await createEmbedding(text);
  const vectorStr = `[${embedding.join(",")}]`;

  // Near-identical restatements of the same entity+relation refresh the
  // existing fact instead of piling up duplicates.
  const [nearest] = await db
    .select({
      id: kasieMemories.id,
      distance: sql<number>`${kasieMemories.embedding} <=> ${vectorStr}::vector`,
    })
    .from(kasieMemories)
    .where(
      and(
        eq(kasieMemories.projectId, input.projectId),
        eq(kasieMemories.entity, input.entity),
        eq(kasieMemories.relation, input.relation),
      ),
    )
    .orderBy(sql`${kasieMemories.embedding} <=> ${vectorStr}::vector`)
    .limit(1);

  if (nearest && nearest.distance <= MEMORY_DEDUP_MAX_DISTANCE) {
    await db
      .update(kasieMemories)
      .set({ target: input.target, embedding, timestamp: new Date() })
      .where(eq(kasieMemories.id, nearest.id));
    return;
  }

  await db.insert(kasieMemories).values({
    projectId: input.projectId,
    entity: input.entity,
    relation: input.relation,
    target: input.target,
    embedding,
  });
}

export type MemoryTriple = { entity: string; relation: string; target: string };

const TRIPLE_COLUMNS = {
  entity: kasieMemories.entity,
  relation: kasieMemories.relation,
  target: kasieMemories.target,
};

/**
 * Two-pass recall: topic similarity via pgvector, plus recent facts keyed to
 * the current speaker (entity `person:<name>`), deduped.
 */
export async function retrieveMemories(
  projectId: string,
  query: string,
  opts: { limit?: number; speakerName?: string } = {},
): Promise<MemoryTriple[]> {
  const limit = opts.limit ?? 5;
  const embedding = await createEmbedding(query);
  const vectorStr = `[${embedding.join(",")}]`;

  const topicPass = db
    .select({
      ...TRIPLE_COLUMNS,
      distance: sql<number>`${kasieMemories.embedding} <=> ${vectorStr}::vector`,
    })
    .from(kasieMemories)
    .where(eq(kasieMemories.projectId, projectId))
    .orderBy(sql`${kasieMemories.embedding} <=> ${vectorStr}::vector`)
    .limit(limit)
    .then((rows) =>
      rows
        .filter((r) => r.distance <= MEMORY_RELEVANCE_MAX_DISTANCE)
        .map(({ entity, relation, target }) => ({ entity, relation, target })),
    );

  const nameFragment = opts.speakerName?.trim().split(/\s+/)[0]?.toLowerCase();
  const speakerPass = nameFragment
    ? db
        .select(TRIPLE_COLUMNS)
        .from(kasieMemories)
        .where(
          and(
            eq(kasieMemories.projectId, projectId),
            ilike(kasieMemories.entity, `person:%${nameFragment}%`),
          ),
        )
        .orderBy(desc(kasieMemories.timestamp))
        .limit(limit)
    : Promise.resolve([] as MemoryTriple[]);

  const [topical, speaker] = await Promise.all([topicPass, speakerPass]);

  const seen = new Set<string>();
  const merged: MemoryTriple[] = [];
  for (const m of [...speaker, ...topical]) {
    const key = `${m.entity}\u0000${m.relation}\u0000${m.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(m);
  }
  return merged;
}

/** Similarity search with row ids for the dashboard memory browser. */
export async function searchMemories(projectId: string, query: string, limit = 25) {
  const embedding = await createEmbedding(query);
  const vectorStr = `[${embedding.join(",")}]`;

  return db
    .select({
      id: kasieMemories.id,
      entity: kasieMemories.entity,
      relation: kasieMemories.relation,
      target: kasieMemories.target,
      timestamp: kasieMemories.timestamp,
    })
    .from(kasieMemories)
    .where(eq(kasieMemories.projectId, projectId))
    .orderBy(sql`${kasieMemories.embedding} <=> ${vectorStr}::vector`)
    .limit(limit);
}

export function formatMemoriesForPrompt(
  memories: { entity: string; relation: string; target: string }[],
): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.entity} ${m.relation} ${m.target}`);
  return `\n\nRelevant team memory:\n${lines.join("\n")}`;
}
