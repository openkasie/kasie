import { humanizeCron } from "@/lib/format";
import { formatRelativeTime, formatUsdFromMicros } from "@/lib/format";
import {
  Chip,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/design-system";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/ssr";
import type {
  InitiativeUsageSummary,
  ScheduleUsageRow,
} from "@/lib/db/queries/usage";

type UsageTasksTableProps = {
  schedules: ScheduleUsageRow[];
  initiative?: InitiativeUsageSummary;
};

export function UsageTasksTable({ schedules, initiative }: UsageTasksTableProps) {
  const hasInitiative = (initiative?.runCount ?? 0) > 0;

  if (schedules.length === 0 && !hasInitiative) {
    return (
      <EmptyState
        icon={<CalendarBlankIcon size={32} weight="regular" />}
        title="No scheduled tasks"
        description="Enable tasks on the Tasks page to see usage here."
      />
    );
  }

  return (
    <Table>
      <TableHead>
        <TableHeaderCell>Task</TableHeaderCell>
        <TableHeaderCell>Frequency</TableHeaderCell>
        <TableHeaderCell>Total runs</TableHeaderCell>
        <TableHeaderCell align="right">Avg cost / run</TableHeaderCell>
        <TableHeaderCell>Last activity</TableHeaderCell>
        <TableHeaderCell>Status</TableHeaderCell>
      </TableHead>
      <TableBody>
        {hasInitiative && initiative ? (
          <TableRow>
            <TableCell>
              <p className="font-medium">Self-directed initiative</p>
            </TableCell>
            <TableCell className="text-[var(--fg-muted)]">When idle</TableCell>
            <TableCell>{initiative.runCount}</TableCell>
            <TableCell align="right" className="font-mono tabular-nums">
              {formatUsdFromMicros(initiative.avgCostMicros)}
            </TableCell>
            <TableCell className="text-[var(--fg-muted)]">
              {initiative.lastActivity
                ? formatRelativeTime(initiative.lastActivity)
                : "—"}
            </TableCell>
            <TableCell>
              <Chip variant="success">Active</Chip>
            </TableCell>
          </TableRow>
        ) : null}
        {schedules.map((schedule) => (
          <TableRow key={schedule.scheduleId}>
            <TableCell>
              <div className="space-y-1">
                <p className="font-medium">{schedule.prompt.slice(0, 80)}</p>
                {!schedule.enabled ? (
                  <Chip variant="default">Paused</Chip>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-[var(--fg-muted)]">
              {humanizeCron(schedule.cron)}
            </TableCell>
            <TableCell>{schedule.runCount}</TableCell>
            <TableCell align="right" className="font-mono tabular-nums">
              {formatUsdFromMicros(schedule.avgCostMicros)}
            </TableCell>
            <TableCell className="text-[var(--fg-muted)]">
              {schedule.lastActivity
                ? formatRelativeTime(schedule.lastActivity)
                : "—"}
            </TableCell>
            <TableCell>
              <Chip variant={schedule.enabled ? "success" : "default"}>
                {schedule.enabled ? "Active" : "Paused"}
              </Chip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
