import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/design-system";
import { requireActiveProject } from "@/lib/auth/session";
import { listMemories, MEMORY_PAGE_SIZE } from "@/lib/db/queries/memories";
import { searchMemories } from "@/lib/embeddings/memory";
import { MemoryBrowser } from "./components/MemoryBrowser";

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { projectId } = await requireActiveProject();
  const { q, page: pageParam } = await searchParams;
  const query = q?.trim() ?? "";
  const page = Math.max(Number(pageParam) || 1, 1);

  const { rows, total } = query
    ? { rows: await searchMemories(projectId, query), total: null }
    : await listMemories(projectId, page);

  const totalPages =
    total != null ? Math.max(Math.ceil(total / MEMORY_PAGE_SIZE), 1) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memory"
        description="Facts your agent has stored about the team, deduped and searched by meaning."
      />

      {rows.length === 0 && !query ? (
        <EmptyState
          title="No memories yet"
          description="Facts appear here as your agent learns them from conversations and connected tools."
        />
      ) : (
        <Suspense fallback={null}>
          <MemoryBrowser
            memories={rows}
            query={query}
            page={page}
            totalPages={totalPages}
            hasNext={total != null ? page * MEMORY_PAGE_SIZE < total : false}
          />
        </Suspense>
      )}
    </div>
  );
}
