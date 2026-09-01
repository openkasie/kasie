import { db } from "@/lib/db/client";
import { kasieAuditEvents } from "@/lib/db/schema";
import type { AuditActorType } from "@/lib/db/schema";
import { createLogger } from "@/lib/log";
import type { AuditAction } from "./actions";
import { categoryForAction } from "./categories";

const log = createLogger("audit");

export type AuditEventInput = {
  orgId: string;
  projectId?: string | null;
  action: AuditAction;
  actorUserId?: string | null;
  actorType: AuditActorType;
  actorLabel: string;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceLabel?: string | null;
  metadata?: Record<string, unknown>;
  costMicros?: number | null;
};

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await db.insert(kasieAuditEvents).values({
      orgId: input.orgId,
      projectId: input.projectId ?? null,
      category: categoryForAction(input.action),
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      actorLabel: input.actorLabel,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      resourceLabel: input.resourceLabel ?? null,
      metadata: input.metadata ?? {},
      costMicros: input.costMicros ?? null,
    });
  } catch (err) {
    log.error("audit event insert failed", { action: input.action, orgId: input.orgId }, err);
  }
}

export function actorFromSession(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Pick<AuditEventInput, "actorUserId" | "actorType" | "actorLabel"> {
  return {
    actorUserId: user.id,
    actorType: "user",
    actorLabel: user.name ?? user.email ?? user.id,
  };
}
