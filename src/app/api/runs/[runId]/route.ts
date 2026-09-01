import { NextResponse } from "next/server";
import { authenticateAgentApiRequest } from "@/lib/auth/agent-api";
import { getRunByIdGlobal, getRunOrgId } from "@/lib/db/queries/runs";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const auth = await authenticateAgentApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { runId } = await context.params;
  const runOrgId = await getRunOrgId(runId);
  if (!runOrgId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (runOrgId !== auth.orgId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const run = await getRunByIdGlobal(runId);
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: run.id,
    thread_id: run.threadId,
    project_id: run.projectId,
    status: run.status,
    input: run.input,
    output: run.output,
    started_at: run.startedAt,
    completed_at: run.completedAt,
  });
}
