import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { IntegrationInstancePanel } from "../../components/IntegrationInstancePanel";
import { getIntegrationApp } from "@/lib/integrations/catalog";
import { getIntegrationById } from "@/lib/db/queries/integrations";
import { requireActiveProject } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { kasieUsers } from "@/lib/db/schema";

export default async function IntegrationInstancePage({
  params,
}: {
  params: Promise<{ appSlug: string; integrationId: string }>;
}) {
  const { projectId } = await requireActiveProject();
  const { appSlug, integrationId } = await params;

  const app = await getIntegrationApp(appSlug);
  if (!app) notFound();

  const integration = await getIntegrationById(projectId, integrationId);
  if (!integration || integration.appSlug !== appSlug || integration.status !== "connected") {
    notFound();
  }

  let creatorName: string | null = null;
  if (integration.createdByUserId) {
    const [creator] = await db
      .select({ name: kasieUsers.name })
      .from(kasieUsers)
      .where(eq(kasieUsers.id, integration.createdByUserId))
      .limit(1);
    creatorName = creator?.name ?? null;
  }

  return (
    <IntegrationInstancePanel
      appSlug={appSlug}
      appLabel={app.label}
      integration={{
        id: integration.id,
        nickname: integration.nickname,
        visibility: integration.visibility,
        enabled: integration.enabled,
        discoveryStatus: integration.discoveryStatus,
        discoverySummary: integration.discoverySummary,
        toolPolicies: integration.toolPolicies ?? {},
        creatorName,
      }}
    />
  );
}
