"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/design-system";
import { getSettingsPageMeta } from "../settings-meta";

export function SettingsPageHeader() {
  const pathname = usePathname();
  const meta = getSettingsPageMeta(pathname);

  return <PageHeader title={meta.title} description={meta.description} />;
}
