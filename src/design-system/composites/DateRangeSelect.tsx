"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "../primitives/Select";
import type { UsageRange } from "@/lib/usage/range";
import { usageRangeLabel } from "@/lib/usage/range";

const OPTIONS: UsageRange[] = ["7d", "30d", "90d"];

type UsageDateRangeProps = {
  className?: string;
};

export function UsageDateRange({ className }: UsageDateRangeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get("range") as UsageRange | null) ?? "30d";
  const value = OPTIONS.includes(current) ? current : "30d";

  return (
    <Select
      className={className}
      value={value}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("range", event.target.value);
        router.replace(`${pathname}?${params.toString()}`);
      }}
      aria-label="Date range"
    >
      {OPTIONS.map((option) => (
        <option key={option} value={option}>
          {usageRangeLabel(option)}
        </option>
      ))}
    </Select>
  );
}
