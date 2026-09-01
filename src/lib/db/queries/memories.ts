import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { kasieMemories } from "../schema";

export const MEMORY_PAGE_SIZE = 25;

const MEMORY_COLUMNS = {
  id: kasieMemories.id,
  entity: kasieMemories.entity,
  relation: kasieMemories.relation,
  target: kasieMemories.target,
  timestamp: kasieMemories.timestamp,
};

export async function listMemories(projectId: string, page = 1) {
  const offset = (Math.max(page, 1) - 1) * MEMORY_PAGE_SIZE;

  const [rows, [totals]] = await Promise.all([
    db
      .select(MEMORY_COLUMNS)
      .from(kasieMemories)
      .where(eq(kasieMemories.projectId, projectId))
      .orderBy(desc(kasieMemories.timestamp))
      .limit(MEMORY_PAGE_SIZE)
      .offset(offset),
    db
      .select({ total: count() })
      .from(kasieMemories)
      .where(eq(kasieMemories.projectId, projectId)),
  ]);

  return { rows, total: totals?.total ?? 0 };
}

export async function deleteMemory(projectId: string, memoryId: string) {
  const [deleted] = await db
    .delete(kasieMemories)
    .where(
      and(eq(kasieMemories.id, memoryId), eq(kasieMemories.projectId, projectId)),
    )
    .returning(MEMORY_COLUMNS);
  return deleted ?? null;
}
