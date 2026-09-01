import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { hasPipedream } from "@/lib/env";
import { env } from "@/lib/env";
import {
  listAccessibleIntegrations,
  type IntegrationVisibility,
} from "@/lib/db/queries/integrations";
import { toPipedreamAppSlug } from "@/lib/pipedream/app-slug";
import { resolveExternalUserId } from "@/lib/pipedream/external-user-id";
import { getPipedreamAccessToken } from "@/lib/pipedream/client";
import { createLogger } from "@/lib/log";
import { classifyTool } from "./classify-tool";

const log = createLogger("mcp");

const MCP_SERVER_URL = "https://remote.mcp.pipedream.net/v3";

export type McpToolDescriptor = {
  name: string;
  description: string;
  classification: "read" | "write";
  appSlug: string;
  integrationId: string;
};

type IntegrationClient = {
  integrationId: string;
  appSlug: string;
  toolPolicies: Record<string, "auto" | "approval" | "disabled">;
  client: MCPClient;
  tools: Record<string, unknown>;
};

async function openClientForIntegration(integration: {
  id: string;
  appSlug: string;
  accountId: string | null;
  visibility: IntegrationVisibility;
  createdByUserId: string | null;
  projectId: string;
  toolPolicies?: Record<string, "auto" | "approval" | "disabled">;
}): Promise<IntegrationClient | null> {
  if (!integration.accountId || !integration.createdByUserId) return null;

  const accessToken = await getPipedreamAccessToken();
  const externalUserId = resolveExternalUserId({
    projectId: integration.projectId,
    userId: integration.createdByUserId,
    visibility: integration.visibility,
  });

  const client = await createMCPClient({
    clientName: "kasie-mcp",
    transport: {
      type: "http",
      url: MCP_SERVER_URL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-pd-project-id": env.PIPEDREAM_PROJECT_ID!,
        "x-pd-environment": env.PIPEDREAM_ENVIRONMENT ?? "development",
        "x-pd-external-user-id": externalUserId,
        "x-pd-app-slug": toPipedreamAppSlug(integration.appSlug),
        "x-pd-account-id": integration.accountId,
      },
    },
  });

  const tools = await client.tools();
  return {
    integrationId: integration.id,
    appSlug: integration.appSlug,
    toolPolicies: integration.toolPolicies ?? {},
    client,
    tools,
  };
}

export class McpGateway {
  private clients = new Map<string, IntegrationClient>();

  async loadClients(projectId: string, userId?: string) {
    if (!hasPipedream()) {
      log.debug("pipedream not configured, skipping client load");
      return [];
    }

    const integrations = await listAccessibleIntegrations(projectId, userId);
    const pipedream = integrations.filter(
      (i) => i.appSlug !== "slack" && i.accountId && i.enabled,
    );
    log.debug("loading mcp clients", {
      projectId,
      integrationCount: pipedream.length,
    });

    const loaded: IntegrationClient[] = [];
    for (const integration of pipedream) {
      try {
        const entry = await openClientForIntegration({
          id: integration.id,
          appSlug: integration.appSlug,
          accountId: integration.accountId,
          visibility: integration.visibility,
          createdByUserId: integration.createdByUserId,
          projectId,
          toolPolicies: integration.toolPolicies ?? {},
        });
        if (entry) {
          this.clients.set(`${integration.appSlug}:${integration.id}`, entry);
          loaded.push(entry);
          log.info("mcp client opened", {
            projectId,
            appSlug: integration.appSlug,
            toolCount: Object.keys(entry.tools).length,
          });
        }
      } catch (err) {
        log.error("mcp client open failed", { appSlug: integration.appSlug, projectId }, err);
      }
    }
    return loaded;
  }

  async discoverTools(projectId: string, userId?: string): Promise<McpToolDescriptor[]> {
    const loaded = await this.loadClients(projectId, userId);
    const descriptors: McpToolDescriptor[] = [];

    for (const entry of loaded) {
      for (const [name, tool] of Object.entries(entry.tools)) {
        const description =
          typeof tool === "object" &&
            tool !== null &&
            "description" in tool &&
            typeof (tool as { description?: unknown }).description === "string"
            ? (tool as { description: string }).description
            : name;

        descriptors.push({
          name,
          description,
          classification: classifyTool(name),
          appSlug: entry.appSlug,
          integrationId: entry.integrationId,
        });
      }
    }

    return descriptors;
  }

  async getAiTools(projectId: string, userId?: string) {
    const loaded = await this.loadClients(projectId, userId);
    const merged: Record<string, unknown> = {};
    for (const entry of loaded) {
      for (const [name, tool] of Object.entries(entry.tools)) {
        const policy = entry.toolPolicies[name] ?? (classifyTool(name) === "write" ? "approval" : "auto");
        if (policy === "disabled") continue;
        merged[name] = tool;
      }
    }
    return merged;
  }

  private resolvePolicy(
    entry: IntegrationClient,
    toolName: string,
  ): "auto" | "approval" | "disabled" {
    return (
      entry.toolPolicies[toolName] ??
      (classifyTool(toolName) === "write" ? "approval" : "auto")
    );
  }

  async executeTool(input: {
    projectId: string;
    userId?: string;
    toolName: string;
    args: Record<string, unknown>;
    force?: boolean;
  }): Promise<{ ok: boolean; result?: unknown; requiresApproval?: boolean }> {
    const tl = log.child({ projectId: input.projectId, toolName: input.toolName });

    if (!hasPipedream()) {
      tl.warn("pipedream not configured");
      return { ok: false, result: { error: "pipedream not configured" } };
    }

    if (this.clients.size === 0) {
      await this.loadClients(input.projectId, input.userId);
    }

    const started = Date.now();
    for (const entry of this.clients.values()) {
      const tool = entry.tools[input.toolName];
      if (!tool || typeof tool !== "object" || tool === null || !("execute" in tool)) {
        continue;
      }

      const policy = this.resolvePolicy(entry, input.toolName);
      if (policy === "disabled") continue;

      if (policy === "approval" && !input.force) {
        tl.info("tool requires approval", { policy });
        return {
          ok: false,
          requiresApproval: true,
          result: { tool: input.toolName, args: input.args },
        };
      }

      try {
        const execute = (tool as { execute: (args: unknown) => Promise<unknown> }).execute;
        const result = await execute(input.args);
        tl.info("tool executed", {
          appSlug: entry.appSlug,
          ok: true,
          durationMs: Date.now() - started,
        });
        return { ok: true, result };
      } catch (err) {
        tl.warn("tool execution failed", {
          appSlug: entry.appSlug,
          durationMs: Date.now() - started,
          error: err instanceof Error ? err.message : "tool execution failed",
        });
        return {
          ok: false,
          result: { error: err instanceof Error ? err.message : "tool execution failed" },
        };
      }
    }

    tl.warn("unknown tool");
    return { ok: false, result: { error: "unknown tool" } };
  }

  async close() {
    await Promise.all(
      [...this.clients.values()].map(async (entry) => {
        try {
          await entry.client.close();
        } catch {
          // ignore close errors
        }
      }),
    );
    this.clients.clear();
  }
}

export const mcpGateway = new McpGateway();

export async function discoverToolsForIntegration(input: {
  projectId: string;
  integrationId: string;
}): Promise<McpToolDescriptor[]> {
  const { getIntegrationById } = await import("@/lib/db/queries/integrations");
  const integration = await getIntegrationById(input.projectId, input.integrationId);
  if (!integration?.accountId || !integration.enabled) return [];

  const entry = await openClientForIntegration({
    id: integration.id,
    appSlug: integration.appSlug,
    accountId: integration.accountId,
    visibility: integration.visibility,
    createdByUserId: integration.createdByUserId,
    projectId: input.projectId,
    toolPolicies: integration.toolPolicies ?? {},
  });
  if (!entry) return [];

  try {
    const descriptors: McpToolDescriptor[] = [];
    for (const [name, tool] of Object.entries(entry.tools)) {
      const description =
        typeof tool === "object" &&
          tool !== null &&
          "description" in tool &&
          typeof (tool as { description?: unknown }).description === "string"
          ? (tool as { description: string }).description
          : name;

      descriptors.push({
        name,
        description,
        classification: classifyTool(name),
        appSlug: entry.appSlug,
        integrationId: entry.integrationId,
      });
    }
    return descriptors;
  } finally {
    await entry.client.close();
  }
}
