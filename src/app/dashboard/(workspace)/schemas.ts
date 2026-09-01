import { z } from "zod";

const personalityTones = ["standard", "friendly", "concise", "formal"] as const;

export const ConfigUpdateSchema = z.object({
  personalityTone: z.enum(personalityTones).optional(),
  workspaceInstructions: z.string().max(4000).optional(),
  modelTier: z.enum(["ultra", "smart", "balanced"]).optional(),
});

export const WorkspaceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

export const SkillToggleSchema = z.object({
  skillId: z.string(),
  enabled: z.boolean(),
});

export const ApprovalActionSchema = z.object({
  actionId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export const ScheduleUpsertSchema = z.object({
  scheduleId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(4000),
  cron: z.string().trim().min(1).max(100),
  timezone: z.string().trim().min(1).max(64),
  channel: z
    .string()
    .trim()
    .max(64)
    .transform((v) => (v === "" ? null : v))
    .nullish(),
  enabled: z.boolean().default(true),
});

export const ScheduleDeleteSchema = z.object({
  scheduleId: z.string().uuid(),
});

export type ConfigUpdate = z.infer<typeof ConfigUpdateSchema>;