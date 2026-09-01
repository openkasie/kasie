import type { ChipVariant } from "../utils/variants";
import { Chip } from "../primitives/Chip";

const STATUS_VARIANT: Record<string, ChipVariant> = {
  queued: "info",
  running: "info",
  awaiting_approval: "warning",
  completed: "success",
  failed: "danger",
  cancelled: "default",
};

type RunStatusBadgeProps = {
  status: string;
};

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  return (
    <Chip variant={STATUS_VARIANT[status] ?? "default"} dot className="capitalize">
      {status.replace(/_/g, " ")}
    </Chip>
  );
}
