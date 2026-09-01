export const AuditActions = {
  runCompleted: "run.completed",
  budgetUpdated: "budget.updated",
  apiKeyCreated: "api_key.created",
  apiKeyRevoked: "api_key.revoked",
  memberRemoved: "member.removed",
  configUpdated: "config.updated",
  workspaceUpdated: "workspace.updated",
  skillToggled: "skill.toggled",
  approvalResolved: "approval.resolved",
  memoryDeleted: "memory.deleted",
  scheduleToggled: "schedule.toggled",
  scheduleCreated: "schedule.created",
  scheduleUpdated: "schedule.updated",
  scheduleDeleted: "schedule.deleted",
  integrationCreated: "integration.created",
  integrationConnected: "integration.connected",
  integrationDisconnected: "integration.disconnected",
  integrationUpdated: "integration.updated",
  slackDisconnected: "slack.disconnected",
  slackReconnectStarted: "slack.reconnect_started",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];
