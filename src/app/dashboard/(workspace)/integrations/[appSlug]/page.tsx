import { notFound, redirect } from "next/navigation";
import { AppIntegrationsHub } from "../components/AppIntegrationsHub";
import { getIntegrationApp } from "@/lib/integrations/catalog";
import { listConnectedIntegrationsByApp } from "@/lib/db/queries/integrations";
import { hasPipedream } from "@/lib/env";
import { requireActiveProject } from "@/lib/auth/session";

export default async function AppIntegrationsPage({
  params,
}: {
  params: Promise<{ appSlug: string }>;
}) {
  const { projectId, session } = await requireActiveProject();
  const { appSlug } = await params;
  const app = await getIntegrationApp(appSlug);
  if (!app) notFound();

  const rows = await listConnectedIntegrationsByApp(
    projectId,
    appSlug,
    session.user.id,
  );

  if (rows.length === 0) {
    redirect(`/dashboard/integrations?connect=${appSlug}`);
  }

  return (
    <AppIntegrationsHub
      appSlug={appSlug}
      appLabel={app.label}
      appDescription={app.description}
      pipedreamEnabled={hasPipedream()}
      instances={rows.map(({ integration, creatorName, creatorEmail }) => ({
        id: integration.id,
        nickname: integration.nickname,
        visibility: integration.visibility,
        discoveryStatus: integration.discoveryStatus,
        enabled: integration.enabled,
        creatorName,
        creatorEmail,
      }))}
    />
  );
}
