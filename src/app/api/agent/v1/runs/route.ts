import { after, NextResponse } from "next/server";
import { z } from "zod";
import { enqueueAndProcess } from "@/lib/agents/process-run";
import { authenticateAgentApiRequest } from "@/lib/auth/agent-api";
import { orgWithinBudget } from "@/lib/usage/budget";
import { getProjectById, upsertThread } from "@/lib/db/queries/projects";
import { createRun, getRunById, getRunByIdempotencyKey } from "@/lib/db/queries/runs";

const agentRunSchema = z.object({
  input: z.string().min(1),
  thread_id: z.string().optional(),
  idempotency_key: z.string().optional(),
  model: z.enum(["ultra", "smart", "balanced"]).optional(),
  project_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const auth = await authenticateAgentApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = agentRunSchema.parse(await request.json());
  const project = await getProjectById(body.project_id);
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  if (project.orgId !== auth.orgId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!(await orgWithinBudget(project.orgId))) {
    return NextResponse.json({ error: "budget_exceeded" }, { status: 429 });
  }

  if (body.idempotency_key) {
    const existing = await getRunByIdempotencyKey(project.id, body.idempotency_key);
    if (existing) {
      return NextResponse.json({
        id: existing.id,
        thread_id: existing.threadId,
        status: existing.status,
        output: existing.output,
      });
    }
  }

  const threadKey = body.thread_id ?? `agent:${crypto.randomUUID()}`;
  const thread = await upsertThread(project.id, threadKey);

  const run = await createRun({
    threadId: thread.id,
    projectId: project.id,
    input: { message: body.input, model: body.model },
    idempotencyKey: body.idempotency_key,
    source: "api",
    initiatedByApiKeyId: auth.keyId,
  });
  if (!run) {
    // Lost the insert race to a concurrent request with the same key.
    const existing = body.idempotency_key
      ? await getRunByIdempotencyKey(project.id, body.idempotency_key)
      : null;
    if (!existing) {
      return NextResponse.json({ error: "run creation failed" }, { status: 500 });
    }
    return NextResponse.json({
      id: existing.id,
      thread_id: existing.threadId,
      status: existing.status,
      output: existing.output,
    });
  }

  after(async () => {
    await enqueueAndProcess({
      runId: run.id,
      projectId: project.id,
      threadId: thread.id,
      payload: { message: body.input },
    });
  });

  const completed = await getRunById(project.id, run.id);
  return NextResponse.json({
    id: run.id,
    thread_id: thread.id,
    status: completed?.status ?? "queued",
    output: completed?.output ?? null,
  });
}
