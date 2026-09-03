import { getRunByIdempotencyKey } from "@/lib/db/queries/runs";
import { getIntegrationById } from "@/lib/db/queries/integrations";
import { upsertThread } from "@/lib/db/queries/projects";
import { createRun } from "@/lib/db/queries/runs";
import { enqueueAndProcess } from "@/lib/agents/process-run";
import { createLogger } from "@/lib/log";

const log = createLogger("enqueue-discovery");

export async function enqueueIntegrationDiscovery(
  projectId: string,
  integrationId: string,
  options?: { force?: boolean },
) {
  const integration = await getIntegrationById(projectId, integrationId);
  if (!integration || integration.status !== "connected") {
    log.debug("discovery skipped", { projectId, integrationId, reason: "not connected" });
    return;
  }

  const idempotencyKey = options?.force
    ? `integration-discovery:${integrationId}:${Date.now()}`
    : `integration-discovery:${integrationId}`;
  const existing = options?.force ? null : await getRunByIdempotencyKey(projectId, idempotencyKey);
  if (existing) {
    log.debug("discovery skipped", { projectId, integrationId, reason: "already queued" });
    return;
  }

  const thread = await upsertThread(
    projectId,
    `integration-discovery:${integrationId}`,
  );

  const run = await createRun({
    threadId: thread.id,
    projectId,
    input: {
      source: "integration_discovery",
      integrationId,
    },
    idempotencyKey,
    source: "system",
  });
  if (!run) {
    log.debug("discovery skipped", { projectId, integrationId, reason: "lost insert race" });
    return;
  }

  const job = await enqueueAndProcess({
    runId: run.id,
    projectId,
    threadId: thread.id,
    payload: {
      source: "integration_discovery",
      integrationId,
      message: `Discover connected integration ${integration.appSlug}`,
    },
  });
  log.info("discovery enqueued", {
    projectId,
    integrationId,
    runId: run.id,
    jobId: job.id,
    appSlug: integration.appSlug,
  });
}
