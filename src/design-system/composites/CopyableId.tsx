"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "@phosphor-icons/react";
import { Button } from "../primitives/Button";

type CopyableIdProps = {
  id: string;
  label?: string;
};

export function CopyableId({ id, label = "Copy" }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context / denied) — no-op.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code
        title={id}
        className="flex-1 truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 font-mono text-xs"
      >
        {id}
      </code>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={copy}
        aria-label={copied ? "Copied to clipboard" : `${label} ${id}`}
      >
        {copied ? (
          <>
            <CheckIcon size={15} weight="bold" className="text-[var(--success-fg)]" />
            Copied
          </>
        ) : (
          <>
            <CopyIcon size={15} />
            {label}
          </>
        )}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
