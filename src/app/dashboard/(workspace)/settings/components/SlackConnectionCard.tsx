"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Chip, FormFeedback, SettingsSectionCard } from "@/design-system";
import {
  disconnectSlackAction,
  reconnectSlackAction,
} from "../actions";

type SlackConnectionCardProps = {
  workspaceName: string;
  platformTeamId: string;
  pending: boolean;
  canManage: boolean;
  origin: string;
  projectId: string;
};

export function SlackConnectionCard({
  workspaceName,
  platformTeamId,
  pending,
  canManage,
  origin,
  projectId,
}: SlackConnectionCardProps) {
  const [pendingAction, start] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});

  return (
    <SettingsSectionCard
      title="Slack connection"
      description={
        pending
          ? "Finish connecting Slack so your team can message the agent."
          : `Kasie is connected to ${workspaceName}. If you disconnect, Kasie will stop accessing your Slack workspace. You can reconnect anytime.`
      }
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-sm font-bold">
          S
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{pending ? "Not connected" : workspaceName}</p>
          {!pending ? (
            <p className="truncate font-mono text-xs text-[var(--fg-muted)]">
              {platformTeamId}
            </p>
          ) : null}
        </div>
        <Chip variant={pending ? "warning" : "success"}>
          {pending ? "Pending" : "Connected"}
        </Chip>
      </div>

      <FormFeedback error={feedback.error} success={feedback.success} className="mt-4" />

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {!pending ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pendingAction}
              onClick={() => {
                setFeedback({});
                start(async () => {
                  const result = await disconnectSlackAction();
                  if (!result.ok) setFeedback({ error: result.error });
                  else setFeedback({ success: "Slack disconnected." });
                });
              }}
            >
              Disconnect
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={pendingAction}
            onClick={() => {
              setFeedback({});
              start(async () => {
                const result = await reconnectSlackAction({ projectId, origin });
                if (result && "error" in result) setFeedback({ error: result.error });
              });
            }}
          >
            {pending ? "Connect Slack" : "Reconnect"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">
          Only organization owners can manage the Slack connection.
        </p>
      )}

      <p className="mt-4 text-sm text-[var(--fg-muted)]">
        Agent personality and model settings are in{" "}
        <Link href="/dashboard/settings/preferences" className="text-[var(--accent)] hover:underline">
          Preferences
        </Link>
        .
      </p>
    </SettingsSectionCard>
  );
}
