import type { ChipVariant } from "../utils/variants";
import { Chip } from "../primitives/Chip";

const STATUS_META: Record<string, { label: string; variant: ChipVariant }> = {
  queued: { label: "Waiting", variant: "info" },
  running: { label: "Working", variant: "info" },
  awaiting_approval: { label: "Needs approval", variant: "warning" },
  completed: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "default" },
};

type RunStatusBadgeProps = {
  status: string;
};

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <Chip variant={meta?.variant ?? "default"} dot className={meta ? undefined : "capitalize"}>
      {meta?.label ?? status.replace(/_/g, " ")}
    </Chip>
  );
}
