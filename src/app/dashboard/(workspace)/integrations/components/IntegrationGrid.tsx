"use client";

import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chip, GlassCard, PageHeader, SearchInput } from "@/design-system";
import type { IntegrationApp } from "@/lib/integrations/types";
import { normalizeAppSlug } from "@/lib/pipedream/app-slug";
import { ConnectIntegrationModal } from "./ConnectIntegrationModal";
import {
  integrationAppIconHover,
  integrationCardHover,
  integrationChevronHover,
  integrationConnectLabelHover,
  integrationFocusRing,
  integrationInteractiveGroup,
} from "./integration-card-styles";

type IntegrationRow = {
  id: string;
  appSlug: string;
  nickname: string;
  visibility: "workspace" | "private";
  status: "pending" | "connected" | "error";
  discoveryStatus: "pending" | "running" | "completed" | "failed";
};

type IntegrationGridProps = {
  apps: IntegrationApp[];
  initialQuery: string;
  integrations: IntegrationRow[];
  pipedreamEnabled: boolean;
};

function IntegrationAppIcon({ app }: { app: IntegrationApp }) {
  return (
    <img
      src={app.imgSrc}
      alt=""
      width={32}
      height={32}
      className={`size-8 shrink-0 rounded-lg bg-[var(--surface-subtle)] object-contain ${integrationAppIconHover}`}
    />
  );
}

type IntegrationSearchProps = {
  initialQuery: string;
  onDebouncedQuery: (query: string) => void;
};

function IntegrationSearch({ initialQuery, onDebouncedQuery }: IntegrationSearchProps) {
  const [draftQuery, setDraftQuery] = useState(initialQuery);

  useEffect(() => {
    if (draftQuery === initialQuery) return;

    const timeout = window.setTimeout(() => {
      onDebouncedQuery(draftQuery);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [draftQuery, initialQuery, onDebouncedQuery]);

  return (
    <SearchInput
      value={draftQuery}
      onChange={setDraftQuery}
      placeholder="Search integrations"
    />
  );
}

export function IntegrationGrid({
  apps,
  initialQuery,
  integrations,
  pipedreamEnabled,
}: IntegrationGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pickedApp, setPickedApp] = useState<IntegrationApp | null>(null);

  const pushQuery = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      params.delete("connect");
      const qs = params.toString();
      router.replace(qs ? `/dashboard/integrations?${qs}` : "/dashboard/integrations");
    },
    [router, searchParams],
  );

  const connectedBySlug = useMemo(() => {
    const map = new Map<string, IntegrationRow[]>();
    for (const row of integrations) {
      if (row.status !== "connected") continue;
      const key = normalizeAppSlug(row.appSlug);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [integrations]);

  const connectedApps = apps.filter((a) => connectedBySlug.has(normalizeAppSlug(a.slug)));
  const availableApps = apps.filter((a) => !connectedBySlug.has(normalizeAppSlug(a.slug)));

  const connectSlug = searchParams.get("connect");
  const urlConnectApp =
    connectSlug && !connectedBySlug.has(normalizeAppSlug(connectSlug))
      ? (apps.find((a) => normalizeAppSlug(a.slug) === normalizeAppSlug(connectSlug)) ?? null)
      : null;
  const connectApp = pickedApp ?? urlConnectApp;

  const closeConnect = () => {
    setPickedApp(null);
    if (connectSlug) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("connect");
      const qs = params.toString();
      router.replace(qs ? `/dashboard/integrations?${qs}` : "/dashboard/integrations");
    }
  };

  const handleConnectSuccess = () => {
    if (!connectApp) return;
    router.push(`/dashboard/integrations/${connectApp.slug}`);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect the tools you use and let your agent perform tasks across apps."
      />

      <IntegrationSearch key={initialQuery} initialQuery={initialQuery} onDebouncedQuery={pushQuery} />

      {!pipedreamEnabled ? (
        <p className="text-sm text-[var(--fg-muted)]">
          Pipedream is not configured. Set PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, and
          PIPEDREAM_PROJECT_ID to browse and connect apps.
        </p>
      ) : null}

      {connectedApps.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
            Connected ({connectedApps.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connectedApps.map((app) => {
              const rows = connectedBySlug.get(normalizeAppSlug(app.slug))!;
              const running = rows.some((r) => r.discoveryStatus === "running");
              return (
                <Link
                  key={app.slug}
                  href={`/dashboard/integrations/${app.slug}`}
                  className={`${integrationInteractiveGroup} ${integrationFocusRing}`}
                >
                  <GlassCard elevation="subtle" className={`p-4 ${integrationCardHover}`}>
                    <div className="flex items-start gap-3">
                      <IntegrationAppIcon app={app} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium transition-colors duration-150 group-hover:text-[var(--fg)]">
                          {app.label}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--fg-muted)]">
                          {app.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Chip variant="success">
                            {rows.length} account{rows.length === 1 ? "" : "s"}
                          </Chip>
                          {running ? <Chip variant="info">Discovering</Chip> : null}
                        </div>
                      </div>
                      <CaretRightIcon
                        size={18}
                        weight="bold"
                        aria-hidden
                        className={integrationChevronHover}
                      />
                    </div>
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
          Available ({availableApps.length})
        </h2>
        {!pipedreamEnabled ? null : availableApps.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">
            {initialQuery
              ? "No integrations match your search."
              : "No integrations available right now."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableApps.map((app) => (
              <button
                key={app.slug}
                type="button"
                onClick={() => setPickedApp(app)}
                className={`${integrationInteractiveGroup} ${integrationFocusRing}`}
              >
                <GlassCard
                  elevation="subtle"
                  className={`flex h-full flex-col justify-between p-4 ${integrationCardHover}`}
                >
                  <div className="flex items-start gap-3">
                    <IntegrationAppIcon app={app} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium transition-colors duration-150 group-hover:text-[var(--fg)]">
                        {app.label}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--fg-muted)]">
                        {app.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between pl-11">
                    <p className={`text-sm font-medium text-[var(--accent)] ${integrationConnectLabelHover}`}>
                      Connect
                    </p>
                    <CaretRightIcon
                      size={18}
                      weight="bold"
                      aria-hidden
                      className={integrationChevronHover}
                    />
                  </div>
                </GlassCard>
              </button>
            ))}
          </div>
        )}
      </section>

      {connectApp ? (
        <ConnectIntegrationModal
          open
          onClose={closeConnect}
          appSlug={connectApp.slug}
          appLabel={connectApp.label}
          pipedreamEnabled={pipedreamEnabled}
          onSuccess={handleConnectSuccess}
        />
      ) : null}
    </div>
  );
}
