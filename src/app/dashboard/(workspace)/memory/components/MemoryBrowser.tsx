"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TrashIcon } from "@phosphor-icons/react";
import { Button, GlassCard, Pagination, SearchInput } from "@/design-system";
import { removeMemory } from "../../actions";

type MemoryRow = {
  id: string;
  entity: string;
  relation: string;
  target: string;
  timestamp: Date;
};

type MemoryBrowserProps = {
  memories: MemoryRow[];
  query: string;
  page: number;
  totalPages?: number;
  hasNext: boolean;
};

export function MemoryBrowser({
  memories,
  query,
  page,
  totalPages,
  hasNext,
}: MemoryBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [pending, start] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  function onSearchChange(value: string) {
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 350);
  }

  function onDelete(memoryId: string) {
    start(async () => {
      await removeMemory({ memoryId });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search memory by meaning"
        className="max-w-md"
      />

      {memories.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">
          Nothing matches that search.
        </p>
      ) : (
        <div className="space-y-2">
          {memories.map((memory) => (
            <GlassCard key={memory.id} elevation="subtle" className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{memory.entity}</span>{" "}
                    <span className="text-[var(--fg-muted)]">{memory.relation}</span>{" "}
                    {memory.target}
                  </p>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">
                    {new Date(memory.timestamp)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={`Forget "${memory.entity} ${memory.relation}"`}
                  icon={<TrashIcon size={15} />}
                  onClick={() => onDelete(memory.id)}
                >
                  Forget
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {!query && (totalPages ?? 1) > 1 ? (
        <Pagination page={page} hasNext={hasNext} totalPages={totalPages} />
      ) : null}
    </div>
  );
}
