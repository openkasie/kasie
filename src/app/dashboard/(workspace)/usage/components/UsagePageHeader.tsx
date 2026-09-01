"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { PageHeader, UsageDateRange } from "@/design-system";
import { getUsagePageMeta } from "../usage-meta";
import { ExportAuditButton } from "./ExportAuditButton";

type UsagePageHeaderProps = {
  isOwner: boolean;
  showExport?: boolean;
};

function UsageHeaderActions({
  isOwner,
  showExport,
}: UsagePageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showExport && isOwner ? <ExportAuditButton /> : null}
      <Suspense fallback={null}>
        <UsageDateRange className="min-w-36" />
      </Suspense>
    </div>
  );
}

export function UsagePageHeader({ isOwner, showExport }: UsagePageHeaderProps) {
  const pathname = usePathname();
  const meta = getUsagePageMeta(pathname);
  const exportVisible = showExport ?? pathname.startsWith("/dashboard/usage/activity");

  return (
    <PageHeader
      title={meta.title}
      description={meta.description}
      actions={<UsageHeaderActions isOwner={isOwner} showExport={exportVisible} />}
    />
  );
}
