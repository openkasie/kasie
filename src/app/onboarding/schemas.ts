import { z } from "zod";
import { CHANNELS } from "./channels";

const channelIds = CHANNELS.map((c) => c.id) as [
  (typeof CHANNELS)[number]["id"],
  ...(typeof CHANNELS)[number]["id"][],
];

const ChannelIdSchema = z.enum(channelIds);

export const CreateWorkspaceSchema = z.object({
  channel: ChannelIdSchema,
  workspaceName: z.string().trim().min(2).max(80),
});

export const SlackOnboardingConnectSchema = z.object({
  channel: ChannelIdSchema,
  workspaceName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(320),
  origin: z.string().url(),
});

export const ProjectIdSchema = z.object({
  projectId: z.string().uuid(),
});

export const OriginSchema = z.object({
  projectId: z.string().uuid(),
  origin: z.string().url(),
});

export const EmailStepSchema = z.object({
  email: z.string().trim().email().max(320),
});

export function onboardingInputError(error: z.ZodError): string {
  const key = error.issues[0]?.path[0];
  if (key === "workspaceName") {
    return "Enter a workspace name (at least 2 characters).";
  }
  if (key === "email") {
    return "Enter a valid work email.";
  }
  if (key === "origin") {
    return "Could not determine site URL. Refresh the page and try again.";
  }
  if (key === "channel") {
    return "Choose a channel to connect.";
  }
  if (key === "projectId") {
    return "Workspace not found. Refresh the page and try again.";
  }
  return "Check your entries and try again.";
}
