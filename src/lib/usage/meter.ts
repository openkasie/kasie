import { eq, sql } from "drizzle-orm";
import type { ModelTier } from "@/lib/ai/types";
import { AuditActions, recordAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { kasieRuns } from "@/lib/db/schema";
import { computeRunCostMicros } from "./cost";

export async function recordRunUsage(input: {
  orgId: string;
  projectId: string;
  runId: string;
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const cost = computeRunCostMicros(
    input.tier,
    input.inputTokens,
    input.outputTokens,
  );
  if (cost <= 0) return;

  await db.execute(sql`
    INSERT INTO kasie_usage_ledger
      (org_id, project_id, run_id, input_tokens, output_tokens, model_tier, estimated_cost_micros)
    VALUES
      (${input.orgId}, ${input.projectId}, ${input.runId}, ${input.inputTokens},
       ${input.outputTokens}, ${input.tier}, ${cost})
    ON CONFLICT (run_id) DO NOTHING
  `);

  const [run] = await db
    .select({
      source: kasieRuns.source,
      initiatedByUserId: kasieRuns.initiatedByUserId,
      initiatedByApiKeyId: kasieRuns.initiatedByApiKeyId,
      runInput: kasieRuns.input,
    })
    .from(kasieRuns)
    .where(eq(kasieRuns.id, input.runId))
    .limit(1);

  const message =
    typeof run?.runInput?.message === "string"
      ? run.runInput.message.slice(0, 80)
      : "Agent run";

  await recordAuditEvent({
    orgId: input.orgId,
    projectId: input.projectId,
    action: AuditActions.runCompleted,
    actorUserId: run?.initiatedByUserId,
    actorType: run?.initiatedByApiKeyId
      ? "api_key"
      : run?.source === "schedule" || run?.source === "initiative"
        ? "system"
        : "agent",
    actorLabel:
      run?.source === "slack"
        ? "Slack"
        : run?.source === "api"
          ? "Agent API"
          : run?.source === "schedule"
            ? "Scheduled task"
            : run?.source === "initiative"
              ? "Initiative"
              : "Kasie",
    resourceType: "run",
    resourceId: input.runId,
    resourceLabel: message,
    metadata: {
      tier: input.tier,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      source: run?.source ?? null,
    },
    costMicros: cost,
  });
}
