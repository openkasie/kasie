import type { ReactNode } from "react";
import { GlassCard } from "./GlassCard";
import { cn } from "../utils/cn";

type TableProps = {
  children: ReactNode;
  className?: string;
};

export function Table({ children, className }: TableProps) {
  return (
    <GlassCard className={cn("overflow-x-auto p-0", className)}>
      <table className="w-full text-sm">{children}</table>
    </GlassCard>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-[var(--surface-solid)]/80 backdrop-blur">
      <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
        {children}
      </tr>
    </thead>
  );
}

export function TableHeaderCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-5 py-3 font-medium",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--surface-subtle)]">
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-5 py-3",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}
