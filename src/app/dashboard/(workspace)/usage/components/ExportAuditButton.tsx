"use client";

import { useTransition } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@/design-system";
import { exportAuditCsv } from "../actions";

export function ExportAuditButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const range = new URLSearchParams(window.location.search).get("range") ?? "30d";
          const result = await exportAuditCsv({ range });
          if (!result.ok) return;
          const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `kasie-audit-${range}.csv`;
          anchor.click();
          URL.revokeObjectURL(url);
        });
      }}
    >
      <DownloadSimpleIcon size={16} className="mr-1.5 inline" />
      {pending ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
