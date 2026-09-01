import { NextResponse } from "next/server";
import { after } from "next/server";
import {
  completeIntegrationByAccount,
} from "@/lib/db/queries/integrations";
import { parseExternalUserId } from "@/lib/pipedream/external-user-id";
import { enqueueIntegrationDiscovery } from "@/lib/integrations/enqueue-discovery";

type WebhookPayload = {
  event: "CONNECTION_SUCCESS" | "CONNECTION_ERROR";
  account?: {
    id: string;
    external_id?: string;
    app?: { name_slug?: string };
  };
};

export async function POST(request: Request) {
  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.event !== "CONNECTION_SUCCESS" || !payload.account?.id) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const externalId = payload.account.external_id;
  const appSlug = payload.account.app?.name_slug;
  if (!externalId || !appSlug) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { projectId } = parseExternalUserId(externalId);
  const integration = await completeIntegrationByAccount({
    projectId,
    appSlug,
    accountId: payload.account.id,
  });

  if (integration) {
    after(() => enqueueIntegrationDiscovery(projectId, integration.id));
  }

  return NextResponse.json({ ok: true, integrationId: integration?.id ?? null });
}
