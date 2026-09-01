import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/lib/db/client";
import { kasieApiKeys } from "@/lib/db/schema";

const API_KEY_PREFIX = "kasie_";
const API_KEY_PREFIX_LOOKUP_LEN = 16;

export type GeneratedApiKey = {
  raw: string;
  prefix: string;
  hash: string;
};

function hashApiKey(raw: string): string {
  const pepper = env.AUTH_SECRET ?? "dev-insecure-pepper";
  return createHash("sha256").update(`${pepper}:${raw}`).digest("hex");
}

function generateApiKey(): GeneratedApiKey {
  const raw = `${API_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return {
    raw,
    prefix: raw.slice(0, API_KEY_PREFIX_LOOKUP_LEN),
    hash: hashApiKey(raw),
  };
}

function buildApiKeyFromRaw(raw: string): GeneratedApiKey {
  return {
    raw,
    prefix: raw.slice(0, API_KEY_PREFIX_LOOKUP_LEN),
    hash: hashApiKey(raw),
  };
}

export async function createOrgApiKey(input: {
  orgId: string;
  name: string;
  createdBy?: string;
  raw?: string;
}) {
  const generated = input.raw
    ? buildApiKeyFromRaw(input.raw)
    : generateApiKey();

  const [row] = await db
    .insert(kasieApiKeys)
    .values({
      orgId: input.orgId,
      name: input.name,
      createdBy: input.createdBy,
      keyPrefix: generated.prefix,
      keyHash: generated.hash,
    })
    .returning();

  return { row, raw: generated.raw };
}

export async function listOrgApiKeys(orgId: string) {
  return db
    .select({
      id: kasieApiKeys.id,
      name: kasieApiKeys.name,
      keyPrefix: kasieApiKeys.keyPrefix,
      lastUsedAt: kasieApiKeys.lastUsedAt,
      revokedAt: kasieApiKeys.revokedAt,
      createdAt: kasieApiKeys.createdAt,
    })
    .from(kasieApiKeys)
    .where(and(eq(kasieApiKeys.orgId, orgId), isNull(kasieApiKeys.revokedAt)))
    .orderBy(kasieApiKeys.createdAt);
}

export async function revokeOrgApiKey(orgId: string, keyId: string) {
  const [row] = await db
    .update(kasieApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(kasieApiKeys.id, keyId),
        eq(kasieApiKeys.orgId, orgId),
        isNull(kasieApiKeys.revokedAt),
      ),
    )
    .returning({ id: kasieApiKeys.id });
  return row ?? null;
}

export async function authenticateApiKey(
  raw: string,
): Promise<{ id: string; orgId: string } | null> {
  if (!raw.startsWith(API_KEY_PREFIX) || raw.length < API_KEY_PREFIX_LOOKUP_LEN) {
    return null;
  }

  const prefix = raw.slice(0, API_KEY_PREFIX_LOOKUP_LEN);
  const hash = hashApiKey(raw);

  const candidates = await db
    .select({
      id: kasieApiKeys.id,
      orgId: kasieApiKeys.orgId,
      keyHash: kasieApiKeys.keyHash,
    })
    .from(kasieApiKeys)
    .where(
      and(eq(kasieApiKeys.keyPrefix, prefix), isNull(kasieApiKeys.revokedAt)),
    );

  const match = candidates.find((c) => c.keyHash === hash);
  if (!match) return null;

  void db
    .update(kasieApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(kasieApiKeys.id, match.id));

  return { id: match.id, orgId: match.orgId };
}
