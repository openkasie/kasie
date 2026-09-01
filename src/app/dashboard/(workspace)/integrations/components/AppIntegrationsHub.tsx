"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CaretRightIcon, LockIcon, UsersIcon, GearIcon } from "@phosphor-icons/react";
import {
  Avatar,
  Button,
  Chip,
  GlassCard,
  PageHeader,
  SearchInput,
} from "@/design-system";
import { ConnectIntegrationModal } from "./ConnectIntegrationModal";
import { IntegrationBreadcrumbs } from "./IntegrationBreadcrumbs";
import {
  integrationCardHover,
  integrationChevronHover,
  integrationFocusRing,
  integrationInteractiveGroup,
} from "./integration-card-styles";

type InstanceRow = {
  id: string;
  nickname: string;
  visibility: "workspace" | "private";
  discoveryStatus: "pending" | "running" | "completed" | "failed";
  enabled: boolean;
  creatorName: string | null;
  creatorEmail: string | null;
};

type AppIntegrationsHubProps = {
  appSlug: string;
  appLabel: string;
  appDescription: string;
  instances: InstanceRow[];
  pipedreamEnabled: boolean;
};

export function AppIntegrationsHub({
  appSlug,
  appLabel,
  appDescription,
  instances,
  pipedreamEnabled,
}: AppIntegrationsHubProps) {
  const [query, setQuery] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return instances;
    return instances.filter(
      (i) =>
        i.nickname.toLowerCase().includes(q) ||
        (i.creatorName?.toLowerCase().includes(q) ?? false),
    );
  }, [instances, query]);

  return (
    <div className="space-y-6">
      <IntegrationBreadcrumbs
        crumbs={[
          { label: "Integrations", href: "/dashboard/integrations" },
          { label: appLabel },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={appLabel} description={appDescription} />
        <Button onClick={() => setConnectOpen(true)} disabled={!pipedreamEnabled}>
          Add another account
        </Button>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search connected accounts"
      />

      <p className="text-sm text-[var(--fg-muted)]">
        {instances.length} account{instances.length === 1 ? "" : "s"} connected
      </p>

      {filtered.length === 0 ? (
        <GlassCard elevation="subtle" className="p-8 text-center">
          <p className="text-sm text-[var(--fg-muted)]">No accounts match your search.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((instance) => (
            <Link
              key={instance.id}
              href={`/dashboard/integrations/${appSlug}/${instance.id}`}
              className={`${integrationInteractiveGroup} ${integrationFocusRing}`}
            >
              <GlassCard
                elevation="subtle"
                className={`flex items-center justify-between gap-4 p-4 ${integrationCardHover}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium transition-colors duration-150 group-hover:text-[var(--fg)]">
                      {instance.nickname}
                    </p>
                    {instance.enabled ? (
                      <span className="size-2 rounded-full bg-emerald-500" aria-label="Active" />
                    ) : (
                      <Chip variant="default">Disabled</Chip>
                    )}
                    {instance.discoveryStatus === "running" ? (
                      <Chip variant="info">Discovering</Chip>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--fg-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar
                        name={instance.creatorName ?? instance.creatorEmail ?? "?"}
                        size="sm"
                      />
                      Added by {instance.creatorName ?? instance.creatorEmail ?? "Unknown"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {instance.visibility === "workspace" ? (
                        <>
                          <UsersIcon size={16} />
                          Workspace
                        </>
                      ) : (
                        <>
                          <LockIcon size={16} />
                          Private
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <GearIcon
                    size={20}
                    className="text-[var(--fg-muted)] transition-[color,transform] duration-150 group-hover:text-[var(--accent)] motion-safe:group-hover:rotate-90 motion-reduce:transform-none"
                    aria-hidden
                  />
                  <CaretRightIcon
                    size={18}
                    weight="bold"
                    aria-hidden
                    className={integrationChevronHover}
                  />
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}

      {connectOpen ? (
        <ConnectIntegrationModal
          open
          onClose={() => setConnectOpen(false)}
          appSlug={appSlug}
          appLabel={appLabel}
          pipedreamEnabled={pipedreamEnabled}
        />
      ) : null}
    </div>
  );
}
