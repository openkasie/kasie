import type { IntegrationVisibility } from "@/lib/db/queries/integrations";

export function resolveExternalUserId(input: {
  projectId: string;
  userId: string;
  visibility: IntegrationVisibility;
}): string {
  if (input.visibility === "workspace") return input.projectId;
  return `${input.projectId}:${input.userId}`;
}

export function parseExternalUserId(externalUserId: string): {
  projectId: string;
  userId?: string;
} {
  const idx = externalUserId.indexOf(":");
  if (idx === -1) return { projectId: externalUserId };
  return {
    projectId: externalUserId.slice(0, idx),
    userId: externalUserId.slice(idx + 1),
  };
}
