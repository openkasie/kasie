import { authenticateApiKey } from "@/lib/db/queries/api-keys";

export type AgentApiAuth = {
  keyId: string;
  orgId: string;
};

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function authenticateAgentApiRequest(
  request: Request,
): Promise<AgentApiAuth | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const auth = await authenticateApiKey(token);
  if (!auth) return null;

  return { keyId: auth.id, orgId: auth.orgId };
}
