import {
  hasDiscordOAuth,
  hasGoogleChatOAuth,
  hasSlackOAuth,
  hasTeamsOAuth,
} from "@/lib/env";
import { CHANNELS, type ChannelId } from "./channels";

const CONFIGURED: Record<ChannelId, () => boolean> = {
  slack: hasSlackOAuth,
  teams: hasTeamsOAuth,
  "google-chat": hasGoogleChatOAuth,
  discord: hasDiscordOAuth,
};

export function getConfiguredChannelIds(): ChannelId[] {
  return CHANNELS.filter((c) => CONFIGURED[c.id]()).map((c) => c.id);
}