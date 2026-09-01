import { Suspense } from "react";
import { redirect } from "next/navigation";
import { IntegrationGrid } from "./components/IntegrationGrid";
import { hasPipedream } from "@/lib/env";
import { listPipedreamIntegrations } from "@/lib/db/queries/integrations";
import { requireActiveProject } from "@/lib/auth/session";
import { getIntegrationApp, listIntegrationCatalog, normalizeAppSlug } from "@/lib/integrations/catalog";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string; q?: string }>;
}) {
  const { projectId } = await requireActiveProject();
  const { connect: connectSlug, q } = await searchParams;
  const integrations = await listPipedreamIntegrations(projectId);

  const connectedSlugs = [
    ...new Set(
      integrations.filter((i) => i.status === "connected").map((i) => i.appSlug),
    ),
  ];

  const apps = await listIntegrationCatalog({
    connectedSlugs,
    q: q?.trim() || undefined,
  });

  if (connectSlug) {
    const app = await getIntegrationApp(connectSlug);
    if (app) {
      const connected = integrations.some(
        (i) =>
          normalizeAppSlug(i.appSlug) === normalizeAppSlug(connectSlug) &&
          i.status === "connected",
      );
      if (connected) redirect(`/dashboard/integrations/${app.slug}`);
    }
  }

  return (
    <Suspense>
      <IntegrationGrid
        pipedreamEnabled={hasPipedream()}
        apps={apps}
        initialQuery={q?.trim() ?? ""}
        integrations={integrations.map((i) => ({
          id: i.id,
          appSlug: i.appSlug,
          nickname: i.nickname,
          visibility: i.visibility,
          status: i.status,
          discoveryStatus: i.discoveryStatus,
        }))}
      />
    </Suspense>
  );
}
