"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Chip,
  Input,
  Label,
  RadioCardGroup,
  Select,
  Switch,
  Tabs,
} from "@/design-system";
import { InlineMarkdown, SlackMrkdwn } from "@/lib/slack/render-mrkdwn";
import type { McpToolDescriptor } from "@/lib/mcp/gateway";
import {
  disconnectIntegrationAction,
  getIntegrationToolsAction,
  rerunDiscoveryAction,
  updateIntegrationAction,
} from "../actions";
import { IntegrationBreadcrumbs } from "./IntegrationBreadcrumbs";
import { integrationToolRowHover } from "./integration-card-styles";

type ToolPolicy = "auto" | "approval" | "disabled";

type IntegrationInstancePanelProps = {
  appSlug: string;
  appLabel: string;
  integration: {
    id: string;
    nickname: string;
    visibility: "workspace" | "private";
    enabled: boolean;
    discoveryStatus: "pending" | "running" | "completed" | "failed";
    discoverySummary: string | null;
    toolPolicies: Record<string, ToolPolicy>;
    creatorName: string | null;
  };
};

const TABS = [
  { id: "tools", label: "Tools" },
  { id: "access", label: "Access" },
  { id: "settings", label: "Settings" },
];

function defaultPolicy(classification: "read" | "write"): ToolPolicy {
  return classification === "write" ? "approval" : "auto";
}

function policyLabel(policy: ToolPolicy) {
  if (policy === "auto") return "Run automatically";
  if (policy === "approval") return "Requires approval";
  return "Disabled";
}

export function IntegrationInstancePanel({
  appSlug,
  appLabel,
  integration,
}: IntegrationInstancePanelProps) {
  const router = useRouter();
  const [tab, setTab] = useState("tools");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nickname, setNickname] = useState(integration.nickname);
  const [visibility, setVisibility] = useState(integration.visibility);
  const [enabled, setEnabled] = useState(integration.enabled);
  const [toolPolicies, setToolPolicies] = useState(integration.toolPolicies);

  const [tools, setTools] = useState<McpToolDescriptor[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolQuery, setToolQuery] = useState("");

  const [toolsLoaded, setToolsLoaded] = useState(false);

  const loadTools = useCallback(() => {
    setToolsLoading(true);
    start(async () => {
      const result = await getIntegrationToolsAction(integration.id);
      setToolsLoading(false);
      setToolsLoaded(true);
      if (result.ok) setTools(result.tools);
      else setError(result.error);
    });
  }, [integration.id]);

  useEffect(() => {
    if (tab === "tools" && !toolsLoaded && !toolsLoading) loadTools();
  }, [tab, toolsLoaded, toolsLoading, loadTools]);

  const handleTabChange = (id: string) => {
    setTab(id);
  };

  const save = (patch: {
    nickname?: string;
    visibility?: "workspace" | "private";
    enabled?: boolean;
    toolPolicies?: Record<string, ToolPolicy>;
  }) => {
    setError(null);
    start(async () => {
      const result = await updateIntegrationAction({
        integrationId: integration.id,
        ...patch,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  };

  const disconnect = () => {
    if (!confirm("Disconnect this account? Kasie will lose access immediately.")) return;
    start(async () => {
      const result = await disconnectIntegrationAction(integration.id);
      if (result.ok) {
        router.push(`/dashboard/integrations/${appSlug}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const filteredTools = tools.filter((t) => {
    const q = toolQuery.trim().toLowerCase();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  const setToolPolicy = (toolName: string, policy: ToolPolicy) => {
    const next = { ...toolPolicies, [toolName]: policy };
    setToolPolicies(next);
    save({ toolPolicies: next });
  };

  return (
    <div className="space-y-6">
      <IntegrationBreadcrumbs
        crumbs={[
          { label: "Integrations", href: "/dashboard/integrations" },
          { label: appLabel, href: `/dashboard/integrations/${appSlug}` },
          { label: integration.nickname },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {appLabel} - {integration.nickname}
        </h1>
        {integration.creatorName ? (
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Connected by {integration.creatorName}
          </p>
        ) : null}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={handleTabChange} />

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {tab === "tools" ? (
        <section className="space-y-4">
          <Input
            value={toolQuery}
            onChange={(e) => setToolQuery(e.target.value)}
            placeholder="Search tools"
            aria-label="Search tools"
          />
          <p className="text-sm text-[var(--fg-muted)]">
            {toolsLoading ? "Loading tools…" : `${filteredTools.length} tools`}
          </p>
          {toolsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)]"
                />
              ))}
            </div>
          ) : filteredTools.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">
              No tools found. Try reconnecting the account or check Pipedream configuration.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {filteredTools.map((tool) => {
                const policy =
                  toolPolicies[tool.name] ?? defaultPolicy(tool.classification);
                return (
                  <li
                    key={tool.name}
                    className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between ${integrationToolRowHover}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{tool.name}</p>
                        <Chip variant={tool.classification === "write" ? "warning" : "default"}>
                          {tool.classification}
                        </Chip>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--fg-muted)]">
                        <InlineMarkdown text={tool.description} />
                      </p>
                    </div>
                    <Select
                      value={policy}
                      onChange={(e) => setToolPolicy(tool.name, e.target.value as ToolPolicy)}
                      disabled={pending}
                      aria-label={`Policy for ${tool.name}`}
                    >
                      <option value="auto">{policyLabel("auto")}</option>
                      <option value="approval">{policyLabel("approval")}</option>
                      <option value="disabled">{policyLabel("disabled")}</option>
                    </Select>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "access" ? (
        <section className="max-w-xl space-y-4">
          <p className="text-sm font-medium">Who should have access?</p>
          <RadioCardGroup
            name="instance-visibility"
            value={visibility}
            onChange={(value) => {
              setVisibility(value);
              save({ visibility: value });
            }}
            options={[
              {
                value: "workspace",
                label: "Everyone in the workspace",
                description: "Anyone on your team can use this connection.",
              },
              {
                value: "private",
                label: "Private",
                description:
                  "Only you can use this account. You can change access later in settings.",
              },
            ]}
          />
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className="max-w-xl space-y-8">
          <div>
            <Label htmlFor="account-label">Account label</Label>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Kasie uses the label to tell your connections apart.
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                id="account-label"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={pending || nickname.trim() === integration.nickname}
                onClick={() => save({ nickname: nickname.trim() })}
              >
                Save
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] pt-6">
            <div>
              <p className="font-medium">Enable integration</p>
              <p className="text-sm text-[var(--fg-muted)]">
                Allow Kasie to use this {appLabel} connection.
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={pending}
              aria-label={`Enable ${appLabel} integration`}
              onCheckedChange={(next) => {
                setEnabled(next);
                save({ enabled: next });
              }}
            />
          </div>

          {integration.discoverySummary ? (
            <div className="border-t border-[var(--border)] pt-6">
              <p className="font-medium">Discovery summary</p>
              <SlackMrkdwn text={integration.discoverySummary} className="mt-2" />
              {integration.discoveryStatus === "running" ? (
                <Chip variant="info" className="mt-2">
                  Discovery in progress
                </Chip>
              ) : null}
              <Button
                variant="secondary"
                className="mt-3"
                disabled={pending || integration.discoveryStatus === "running"}
                onClick={() => {
                  start(async () => {
                    await rerunDiscoveryAction(integration.id);
                    router.refresh();
                  });
                }}
              >
                Re-run discovery
              </Button>
            </div>
          ) : null}

          <div className="border-t border-[var(--border)] pt-6">
            <p className="font-medium text-red-600 dark:text-red-400">Disconnect integration</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Remove this connection and revoke Kasie&apos;s access.
            </p>
            <Button variant="danger" className="mt-3" disabled={pending} onClick={disconnect}>
              Disconnect integration
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
