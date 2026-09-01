import type { JSX } from "react";
import { KasieLogo } from "@/design-system";
import type { ChannelId } from "../channels";

type MarkProps = { className?: string };

function SlackMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#E01E5A" d="M5.5 15.2a2.3 2.3 0 1 1-2.3-2.3h2.3v2.3Z" />
      <path fill="#E01E5A" d="M6.7 15.2a2.3 2.3 0 1 1 4.6 0v5.8a2.3 2.3 0 1 1-4.6 0v-5.8Z" />
      <path fill="#36C5F0" d="M8.8 5.5a2.3 2.3 0 1 1 2.3-2.3v2.3H8.8Z" />
      <path fill="#36C5F0" d="M8.8 6.7a2.3 2.3 0 1 1 0 4.6H3a2.3 2.3 0 1 1 0-4.6h5.8Z" />
      <path fill="#2EB67D" d="M18.5 8.8a2.3 2.3 0 1 1 2.3 2.3h-2.3V8.8Z" />
      <path fill="#2EB67D" d="M17.3 8.8a2.3 2.3 0 1 1-4.6 0V3a2.3 2.3 0 1 1 4.6 0v5.8Z" />
      <path fill="#ECB22E" d="M15.2 18.5a2.3 2.3 0 1 1-2.3 2.3v-2.3h2.3Z" />
      <path fill="#ECB22E" d="M15.2 17.3a2.3 2.3 0 1 1 0-4.6H21a2.3 2.3 0 1 1 0 4.6h-5.8Z" />
    </svg>
  );
}

function TeamsMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="6" width="12" height="12" rx="2" fill="#5059C9" />
      <text x="9" y="15" textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
        T
      </text>
      <circle cx="17.5" cy="8.5" r="2.5" fill="#7B83EB" />
      <rect x="15" y="12" width="6" height="7" rx="2" fill="#7B83EB" />
    </svg>
  );
}

function GoogleChatMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#00AC47"
        d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v6A3.5 3.5 0 0 1 16.5 16H10l-4.2 3.2c-.7.5-1.8 0-1.8-.9V6.5Z"
      />
      <path fill="#fff" d="M8 8h8v2H8V8Zm0 3.5h5V13.5H8v-2Z" />
    </svg>
  );
}

function DiscordMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#5865F2" />
      <path
        fill="#fff"
        d="M16.6 7.2c-1-.5-2.1-.8-3.2-1l-.4.8c1 .2 1.9.5 2.8.9-2.4-1.2-5.1-1.2-7.6 0 .9-.4 1.8-.7 2.8-.9l-.4-.8c-1.1.2-2.2.5-3.2 1C5.4 10 4.8 13.5 5 16.9c1.3 1 2.8 1.6 4.4 2l.6-.9c-.8-.3-1.5-.7-2.2-1.2.2-.1.4-.3.6-.4 2.4 1.1 5.1 1.1 7.5 0 .2.1.4.3.6.4-.7.5-1.4.9-2.2 1.2l.6.9c1.6-.4 3.1-1 4.4-2 .3-3.4-.3-6.9-2.1-9.7ZM9.7 14.6c-.7 0-1.3-.7-1.3-1.5s.6-1.5 1.3-1.5 1.3.7 1.3 1.5-.6 1.5-1.3 1.5Zm4.6 0c-.7 0-1.3-.7-1.3-1.5s.6-1.5 1.3-1.5 1.3.7 1.3 1.5-.6 1.5-1.3 1.5Z"
      />
    </svg>
  );
}

const MARKS: Record<ChannelId, (props: MarkProps) => JSX.Element> = {
  slack: SlackMark,
  teams: TeamsMark,
  "google-chat": GoogleChatMark,
  discord: DiscordMark,
};

export function ChannelMark({
  id,
  className = "size-8",
}: {
  id: ChannelId;
  className?: string;
}) {
  const Mark = MARKS[id];
  return <Mark className={className} />;
}

export function KasieMark({ className = "size-16" }: MarkProps) {
  return <KasieLogo size="lg" imageClassName={className} />;
}
