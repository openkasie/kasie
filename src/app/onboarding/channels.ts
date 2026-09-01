export const CHANNELS = [
  { id: "slack", label: "Slack" },
  { id: "teams", label: "Microsoft Teams" },
  { id: "google-chat", label: "Google Chat" },
  { id: "discord", label: "Discord" },
] as const;

export type ChannelId = (typeof CHANNELS)[number]["id"];

export function isChannelId(value: string): value is ChannelId {
  return CHANNELS.some((c) => c.id === value);
}

export function channelLabel(id: ChannelId) {
  return CHANNELS.find((c) => c.id === id)?.label ?? id;
}
