import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getActiveProjectId } from "@/lib/auth/session";
import { hasProjectAccess } from "@/lib/db/queries/orgs";
import {
  countConnectedIntegrationsByApp,
  createPendingIntegration,
  getIntegrationById,
} from "@/lib/db/queries/integrations";
import { defaultIntegrationNickname, getIntegrationApp } from "@/lib/integrations/catalog";
import { env, hasPipedream } from "@/lib/env";
import { createConnectToken } from "@/lib/pipedream/connect-token";

const bodySchema = z.object({
  appSlug: z.string().min(1),
  visibility: z.enum(["workspace", "private"]),
  integrationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  if (!hasPipedream()) {
    return NextResponse.json({ error: "pipedream not configured" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const projectId = await getActiveProjectId();
  if (
    !projectId ||
    !(session.user.isSuperadmin || (await hasProjectAccess(session.user.id, projectId)))
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { appSlug, visibility, integrationId } = parsed.data;

  const app = await getIntegrationApp(appSlug);
  if (!app) {
    return NextResponse.json({ error: "unknown app" }, { status: 400 });
  }

  let integration =
    integrationId ? await getIntegrationById(projectId, integrationId) : null;

  if (!integration) {
    const count = await countConnectedIntegrationsByApp(projectId, appSlug);
    const nickname = defaultIntegrationNickname(app.label, count + 1);

    integration = await createPendingIntegration({
      projectId,
      appSlug,
      nickname,
      visibility,
      createdByUserId: session.user.id,
    });
  }

  const webhookUri = env.APP_URL
    ? `${env.APP_URL.replace(/\/$/, "")}/api/pipedream/webhook`
    : undefined;

  const requestOrigin = request.headers.get("origin")?.replace(/\/$/, "");
  const allowedOrigins = requestOrigin
    ? [requestOrigin]
    : env.APP_URL
      ? [env.APP_URL.replace(/\/$/, "")]
      : undefined;

  const tokenResult = await createConnectToken({
    projectId,
    userId: session.user.id,
    visibility: integration.visibility,
    webhookUri,
    allowedOrigins,
  });

  return NextResponse.json({
    token: tokenResult.token,
    expiresAt: tokenResult.expiresAt,
    connectLinkUrl: tokenResult.connectLinkUrl,
    externalUserId: tokenResult.externalUserId,
    integrationId: integration.id,
  });
}
