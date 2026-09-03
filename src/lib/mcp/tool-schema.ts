/** Subset of MCP tool inputSchema (JSON Schema object). */
export type McpInputSchema = {
  type?: unknown;
  properties?: Record<string, { type?: unknown; description?: string }>;
  required?: string[];
};

export type McpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  title?: string;
};

export function requiredParams(schema?: McpInputSchema): string[] {
  if (!schema?.required?.length) return [];
  return schema.required.filter((key) => typeof key === "string");
}

export function hasRequiredParams(schema?: McpInputSchema): boolean {
  return requiredParams(schema).length > 0;
}
