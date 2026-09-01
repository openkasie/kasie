"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/design-system/utils/cn";
import { USAGE_TABS } from "../usage-meta";

function UsageNavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <nav
      className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-1"
      aria-label="Usage sections"
    >
      {USAGE_TABS.map((tab) => {
        const active =
          tab.href === "/dashboard/usage"
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        const href = query ? `${tab.href}?${query}` : tab.href;

        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--surface-elevated)] text-[var(--fg)] shadow-sm ring-1 ring-[var(--border-elevated)]"
                : "text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function UsageNav() {
  return (
    <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded-xl bg-[var(--surface-subtle)]" />}>
      <UsageNavLinks />
    </Suspense>
  );
}
