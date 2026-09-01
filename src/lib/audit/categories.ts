import type { AuditEventCategory } from "@/lib/db/schema";
import type { AuditAction } from "./actions";
import { AuditActions } from "./actions";

const ACTION_CATEGORY: Record<AuditAction, AuditEventCategory> = {
  [AuditActions.runCompleted]: "run",
  [AuditActions.budgetUpdated]: "admin",
  [AuditActions.apiKeyCreated]: "security",
  [AuditActions.apiKeyRevoked]: "security",
  [AuditActions.memberRemoved]: "admin",
  [AuditActions.configUpdated]: "admin",
  [AuditActions.workspaceUpdated]: "admin",
  [AuditActions.skillToggled]: "admin",
  [AuditActions.approvalResolved]: "approval",
  [AuditActions.scheduleToggled]: "schedule",
  [AuditActions.scheduleCreated]: "schedule",
  [AuditActions.scheduleUpdated]: "schedule",
  [AuditActions.scheduleDeleted]: "schedule",
  [AuditActions.integrationCreated]: "admin",
  [AuditActions.integrationConnected]: "admin",
  [AuditActions.integrationDisconnected]: "admin",
  [AuditActions.integrationUpdated]: "admin",
  [AuditActions.slackDisconnected]: "security",
  [AuditActions.slackReconnectStarted]: "security",
};

export function categoryForAction(action: AuditAction): AuditEventCategory {
  return ACTION_CATEGORY[action];
}

export const MEMBER_VISIBLE_CATEGORIES: AuditEventCategory[] = [
  "run",
  "approval",
  "schedule",
];
