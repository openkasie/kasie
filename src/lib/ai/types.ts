export type ModelTier = "ultra" | "smart" | "balanced";

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ModelConfig = {
  model: string;
  maxOutputTokens: number;
};

export type RunInput = {
  message: string;
  metadata?: Record<string, unknown>;
};

export type RunResult = {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
  pendingActionId?: string;
};

export type RunContext = {
  projectId: string;
  orgId: string | null;
  threadId: string;
  runId: string;
  config: {
    modelTier: ModelTier;
    personalityTone: string;
    workspaceInstructions: string | null;
    systemPrompt: string | null;
    agentName: string;
    enabledSkillIds: string[];
    timezone: string;
  };
};

export type RunJob = {
  id: string;
  runId: string;
  projectId: string;
  threadId: string;
  payload: Record<string, unknown>;
};
