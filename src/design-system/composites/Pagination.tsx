"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Button } from "../primitives/Button";
import { cn } from "../utils/cn";

type PaginationProps = {
  page: number;
  hasNext: boolean;
  totalPages?: number;
  className?: string;
};

export function Pagination({ page, hasNext, totalPages, className }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={<CaretLeftIcon size={15} weight="bold" />}
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        Prev
      </Button>
      <span className="text-sm tabular-nums text-[var(--fg-muted)]">
        Page {page}
        {totalPages != null ? ` of ${totalPages}` : ""}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!hasNext}
        onClick={() => go(page + 1)}
      >
        Next
        <CaretRightIcon size={15} weight="bold" />
      </Button>
    </nav>
  );
}
