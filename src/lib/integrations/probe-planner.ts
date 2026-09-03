import { hasRequiredParams, requiredParams, type McpInputSchema } from "../mcp/tool-schema.ts";

export type ProbeTool = {
  name: string;
  description: string;
  classification: "read" | "write";
  inputSchema?: McpInputSchema;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
};

export type ProbeContext = {
  results: { toolName: string; ok: boolean; result?: unknown }[];
};

export type ProbeStep = {
  toolName: string;
  args?: Record<string, unknown> | ((ctx: ProbeContext) => Record<string, unknown> | null);
  /** Reload MCP tool catalog after this step succeeds (Pipedream dynamic props). */
  reloadAfter?: boolean;
};

/** Pipedream dropdown/config helpers — not real data reads unless used as fallback. */
const CONFIG_HELPER = /-(options|props|prop|configure|dynamic-properties|id-options)$/i;

const CONFIG_DESCRIPTION =
  /\b(dropdown|select an option|pick a value|configuration prop|dynamic prop)\b/i;

const META_PROBE = /^(retrieve_options|CONFIGURE_COMPONENT|configure_component)$/i;

const BEGIN_CONFIGURATION = /^begin_configuration_/i;

export type ConfigureHint = { key: string; propName: string };

/** Parse Pipedream tool descriptions for CONFIGURE_COMPONENT hints. */
export function extractConfigureHints(tools: ProbeTool[]): ConfigureHint[] {
  const hints = new Map<string, ConfigureHint>();
  const re = /key:\s*([^\s,]+)[\s\S]{0,120}?propName:\s*([A-Za-z0-9_]+)/gi;

  for (const tool of tools) {
    const matches = tool.description.matchAll(re);
    for (const match of matches) {
      const key = match[1];
      const propName = match[2];
      if (!key || !propName) continue;
      hints.set(`${key}:${propName}`, { key, propName });
    }
  }

  return [...hints.values()];
}

function isMetaProbeTool(name: string): boolean {
  return META_PROBE.test(name) || BEGIN_CONFIGURATION.test(name);
}

function isConfigHelper(tool: ProbeTool): boolean {
  return CONFIG_HELPER.test(tool.name) || CONFIG_DESCRIPTION.test(tool.description);
}

function isProbeCandidate(tool: ProbeTool): boolean {
  if (isMetaProbeTool(tool.name)) return true;
  if (isConfigHelper(tool)) return false;
  if (tool.readOnlyHint === false || tool.destructiveHint === true) return false;
  if (tool.readOnlyHint === true) return true;
  return tool.classification === "read";
}

function isFallbackConfigProbe(tool: ProbeTool): boolean {
  if (tool.classification === "write" || tool.destructiveHint) return false;
  return isConfigHelper(tool);
}

function probeScore(tool: ProbeTool): number {
  let score = 0;
  const required = requiredParams(tool.inputSchema);
  if (required.length === 0) score += 10;
  if (tool.readOnlyHint) score += 5;
  if (isMetaProbeTool(tool.name)) score += 8;
  if (/\b(list|get|search|find|retrieve|query|fetch|read|show|describe)\b/i.test(tool.name)) {
    score += 4;
  }
  score -= required.length * 3;
  return score;
}

function extractParamFromResult(param: string, result: unknown): unknown | null {
  if (result == null) return null;

  if (typeof result === "object" && !Array.isArray(result)) {
    const root = result as Record<string, unknown>;
    if (param in root && root[param] != null && root[param] !== "") return root[param];

    const camel = param.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    if (camel in root && root[camel] != null && root[camel] !== "") return root[camel];

    if (param.endsWith("_id")) {
      const base = param.slice(0, -3);
      const listKeys = [
        `${base}s`,
        `${base}List`,
        base,
        `${base}es`,
        "data",
        "items",
        "results",
        "options",
        "values",
      ];
      for (const key of listKeys) {
        const list = root[key];
        if (!Array.isArray(list) || list.length === 0) continue;
        const first = list[0];
        if (typeof first === "object" && first !== null) {
          const record = first as Record<string, unknown>;
          const id = record.id ?? record.value ?? record.key;
          if (typeof id === "string" && id.length > 0) return id;
        }
      }

      for (const value of Object.values(root)) {
        if (!Array.isArray(value) || value.length === 0) continue;
        const first = value[0];
        if (typeof first === "object" && first !== null) {
          const record = first as Record<string, unknown>;
          const id = record.id ?? record.value ?? record.key;
          if (typeof id === "string" && id.length > 0) return id;
        }
      }
    }
  }

  if (Array.isArray(result) && result.length > 0) {
    const first = result[0];
    if (typeof first === "object" && first !== null) {
      const record = first as Record<string, unknown>;
      const id = record.id ?? record.value ?? record.key;
      if (typeof id === "string" && id.length > 0) return id;
    }
  }

  return null;
}

function findParamValue(param: string, ctx: ProbeContext): unknown | null {
  for (const probe of ctx.results) {
    if (!probe.ok) continue;
    const value = extractParamFromResult(param, probe.result);
    if (value != null) return value;
  }
  return null;
}

function resolveRequiredArgs(
  schema: McpInputSchema | undefined,
  ctx: ProbeContext,
): Record<string, unknown> | null {
  const required = requiredParams(schema);
  const args: Record<string, unknown> = {};

  for (const param of required) {
    const value = findParamValue(param, ctx);
    if (value == null) return null;
    args[param] = value;
  }

  return args;
}

function planConfigureComponentSteps(
  tools: ProbeTool[],
  steps: ProbeStep[],
  planned: Set<string>,
  maxSteps: number,
) {
  const configureTool = tools.find((t) => META_PROBE.test(t.name) && /configure/i.test(t.name));
  if (!configureTool || steps.length >= maxSteps) return;

  for (const hint of extractConfigureHints(tools)) {
    if (steps.length >= maxSteps) break;
    const stepKey = `CONFIGURE:${hint.key}:${hint.propName}`;
    if (planned.has(stepKey)) continue;

    steps.push({
      toolName: configureTool.name,
      args: { key: hint.key, propName: hint.propName },
      reloadAfter: true,
    });
    planned.add(stepKey);
  }
}

function planMetaToolSteps(
  tools: ProbeTool[],
  steps: ProbeStep[],
  planned: Set<string>,
  maxSteps: number,
) {
  for (const tool of tools) {
    if (steps.length >= maxSteps) break;
    if (!isMetaProbeTool(tool.name)) continue;
    if (planned.has(tool.name)) continue;
    if (/configure/i.test(tool.name)) continue;

    steps.push({
      toolName: tool.name,
      args: {},
      reloadAfter: true,
    });
    planned.add(tool.name);
  }
}

/**
 * Build a probe plan from MCP tool metadata — no per-app hardcoding.
 * Prefers meta/config tools, then read-only zero-arg tools, then chained tools,
 * then config helpers when the catalog lacks list/get actions.
 */
export function planProbeSteps(tools: ProbeTool[], maxSteps = 8): ProbeStep[] {
  const ranked = tools.filter(isProbeCandidate).sort((a, b) => probeScore(b) - probeScore(a));
  const steps: ProbeStep[] = [];
  const planned = new Set<string>();

  planMetaToolSteps(tools, steps, planned, maxSteps);
  planConfigureComponentSteps(tools, steps, planned, maxSteps);

  for (const tool of ranked) {
    if (steps.length >= maxSteps) break;
    if (planned.has(tool.name)) continue;
    if (hasRequiredParams(tool.inputSchema)) continue;

    steps.push({ toolName: tool.name, args: {} });
    planned.add(tool.name);
  }

  for (const tool of ranked) {
    if (steps.length >= maxSteps) break;
    if (planned.has(tool.name)) continue;
    if (!hasRequiredParams(tool.inputSchema)) continue;

    const schema = tool.inputSchema;
    steps.push({
      toolName: tool.name,
      args: (ctx) => resolveRequiredArgs(schema, ctx),
    });
    planned.add(tool.name);
  }

  const fallback = tools
    .filter(isFallbackConfigProbe)
    .sort((a, b) => probeScore(b) - probeScore(a));

  const hasDataReadStep = steps.some((step) => {
    const tool = tools.find((t) => t.name === step.toolName);
    return tool != null && isProbeCandidate(tool) && !isMetaProbeTool(tool.name);
  });

  if (!hasDataReadStep) {
    for (const tool of fallback) {
      if (steps.length >= maxSteps) break;
      if (planned.has(tool.name)) continue;

      const schema = tool.inputSchema;
      if (hasRequiredParams(schema)) {
        steps.push({
          toolName: tool.name,
          args: (ctx) => resolveRequiredArgs(schema, ctx) ?? {},
          reloadAfter: true,
        });
      } else {
        steps.push({ toolName: tool.name, args: {}, reloadAfter: true });
      }
      planned.add(tool.name);
    }
  }

  return steps;
}

export function resolveProbeArgs(
  step: ProbeStep,
  ctx: ProbeContext,
): Record<string, unknown> | null {
  if (typeof step.args === "function") return step.args(ctx);
  return step.args ?? {};
}
