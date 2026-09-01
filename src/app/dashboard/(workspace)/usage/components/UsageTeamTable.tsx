"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
  ConfigPanel,
  EmptyState,
  SearchInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/design-system";
import { UsersIcon } from "@phosphor-icons/react";
import { formatRelativeTime, formatUsdFromMicros } from "@/lib/format";
import type { MemberUsageRow } from "@/lib/db/queries/usage";

type UsageTeamTableProps = {
  activeMemberCount: number;
  members: MemberUsageRow[];
};

type SortKey = "label" | "runCount" | "spendMicros" | "lastActivity";

export function UsageTeamTable({ activeMemberCount, members }: UsageTeamTableProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "spendMicros",
    dir: "desc",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? members.filter((member) => member.label.toLowerCase().includes(q))
      : members;

    return [...list].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "label") return a.label.localeCompare(b.label) * dir;
      if (sort.key === "runCount") return (a.runCount - b.runCount) * dir;
      if (sort.key === "lastActivity") {
        const aTime = a.lastActivity?.getTime() ?? 0;
        const bTime = b.lastActivity?.getTime() ?? 0;
        return (aTime - bTime) * dir;
      }
      return (a.spendMicros - b.spendMicros) * dir;
    });
  }, [members, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  }

  return (
    <div className="space-y-4">
      <ConfigPanel
        title="Total users"
        description={`${activeMemberCount} active user${activeMemberCount === 1 ? "" : "s"} in organization`}
      >
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search people"
          className="max-w-md"
        />
      </ConfigPanel>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={32} weight="regular" />}
          title="No usage for this range"
          description="Team spend will appear here once runs are recorded."
        />
      ) : (
        <Table>
          <TableHead>
            <TableHeaderCell>
              <button type="button" onClick={() => toggleSort("label")}>
                User
              </button>
            </TableHeaderCell>
            <TableHeaderCell>
              <button type="button" onClick={() => toggleSort("runCount")}>
                Runs
              </button>
            </TableHeaderCell>
            <TableHeaderCell align="right">
              <button type="button" onClick={() => toggleSort("spendMicros")}>
                Estimated spend
              </button>
            </TableHeaderCell>
            <TableHeaderCell>
              <button type="button" onClick={() => toggleSort("lastActivity")}>
                Last activity
              </button>
            </TableHeaderCell>
          </TableHead>
          <TableBody>
            {filtered.map((member) => (
              <TableRow key={member.key}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={member.label} image={member.image} />
                    <span className="font-medium">{member.label}</span>
                  </div>
                </TableCell>
                <TableCell className="text-[var(--fg-muted)]">
                  {member.runCount} run{member.runCount === 1 ? "" : "s"}
                </TableCell>
                <TableCell align="right" className="font-mono tabular-nums">
                  {formatUsdFromMicros(member.spendMicros)}
                </TableCell>
                <TableCell className="text-[var(--fg-muted)]">
                  {member.lastActivity
                    ? formatRelativeTime(member.lastActivity)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
