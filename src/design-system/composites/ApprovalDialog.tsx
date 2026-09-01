"use client";

import { Button } from "../primitives/Button";
import { GlassCard } from "./GlassCard";
import { Heading } from "../primitives/Heading";

type ApprovalDialogProps = {
  toolName: string;
  payload: Record<string, unknown>;
  onApprove: () => void;
  onReject: () => void;
  pending?: boolean;
};

export function ApprovalDialog({
  toolName,
  payload,
  onApprove,
  onReject,
  pending,
}: ApprovalDialogProps) {
  return (
    <GlassCard elevation="elevated">
      <Heading as="h3">Approve action</Heading>
      <p className="text-sm text-[var(--fg-muted)] mt-1">Tool: {toolName}</p>
      <pre className="mt-3 overflow-auto rounded-lg bg-[var(--surface-subtle)] p-3 text-xs">
        {JSON.stringify(payload, null, 2)}
      </pre>
      <div className="mt-4 flex gap-2">
        <Button onClick={onApprove} disabled={pending}>
          Approve
        </Button>
        <Button variant="danger" onClick={onReject} disabled={pending}>
          Reject
        </Button>
      </div>
    </GlassCard>
  );
}
