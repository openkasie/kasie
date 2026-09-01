import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getOrgById } from "@/lib/db/queries/orgs";
import { kasieOrgs, kasieUsageLedger } from "@/lib/db/schema";
import { CENTS_TO_MICROS, utcMonthStart } from "./cost";

async function monthSpendMicros(
  orgId: string,
  now = new Date(),
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${kasieUsageLedger.estimatedCostMicros}), 0)`,
    })
    .from(kasieUsageLedger)
    .where(
      and(
        eq(kasieUsageLedger.orgId, orgId),
        gte(kasieUsageLedger.createdAt, utcMonthStart(now)),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function orgWithinBudget(orgId: string | null): Promise<boolean> {
  if (!orgId) return true;
  const org = await getOrgById(orgId);
  if (!org || org.monthlyBudgetCents == null) return true;
  const spent = await monthSpendMicros(orgId);
  return spent < org.monthlyBudgetCents * CENTS_TO_MICROS;
}

export async function setOrgMonthlyBudget(
  orgId: string,
  monthlyBudgetCents: number | null,
): Promise<void> {
  if (
    monthlyBudgetCents != null &&
    (!Number.isInteger(monthlyBudgetCents) || monthlyBudgetCents < 0)
  ) {
    throw new Error("budget must be a non-negative integer number of cents");
  }

  await db
    .update(kasieOrgs)
    .set({ monthlyBudgetCents })
    .where(eq(kasieOrgs.id, orgId));
}
