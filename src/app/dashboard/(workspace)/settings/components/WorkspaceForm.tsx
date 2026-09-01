"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  CopyableId,
  FormFeedback,
  Input,
  Label,
  SettingsSectionCard,
  Textarea,
} from "@/design-system";
import { updateWorkspaceIdentity } from "../../actions";

const SYSTEM_PROMPT_MAX = 4000;

type WorkspaceFormProps = {
  name: string;
  projectId: string;
  agentName: string;
  systemPrompt: string;
};

export function WorkspaceForm({
  name,
  projectId,
  agentName,
  systemPrompt,
}: WorkspaceFormProps) {
  const [pending, start] = useTransition();
  const [agentPending, startAgent] = useTransition();
  const router = useRouter();
  const [nameValue, setNameValue] = useState(name);
  const [agentNameValue, setAgentNameValue] = useState(agentName);
  const [systemPromptValue, setSystemPromptValue] = useState(systemPrompt);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [agentFeedback, setAgentFeedback] = useState<{ error?: string; success?: string }>({});

  const dirty = nameValue !== name;
  const agentDirty =
    agentNameValue !== agentName || systemPromptValue !== systemPrompt;

  const save = () => {
    setFeedback({});
    start(async () => {
      const result = await updateWorkspaceIdentity({ name: nameValue });
      if (!result.ok) setFeedback({ error: result.error });
      else {
        setFeedback({ success: "Workspace updated." });
        router.refresh();
      }
    });
  };

  const saveAgent = () => {
    setAgentFeedback({});
    startAgent(async () => {
      const result = await updateWorkspaceIdentity({
        agentName: agentNameValue,
        systemPrompt: systemPromptValue,
      });
      if (!result.ok) setAgentFeedback({ error: result.error });
      else {
        setAgentFeedback({ success: "Agent identity updated." });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        title="Workspace information"
        description="Your workspace name shown across Kasie."
        footer={
          <Button type="button" disabled={pending || !dirty} onClick={save}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        }
      >
        <div className="space-y-4">
          <FormFeedback error={feedback.error} success={feedback.success} />

          <div>
            <Label htmlFor="team-name">Team name</Label>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              Your workspace label in the Kasie dashboard.
            </p>
            <Input
              id="team-name"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              className="mt-1"
              maxLength={80}
            />
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Agent identity"
        description="The name your agent goes by and its core role description."
        footer={
          <Button type="button" disabled={agentPending || !agentDirty} onClick={saveAgent}>
            {agentPending ? "Saving..." : "Save changes"}
          </Button>
        }
      >
        <div className="space-y-4">
          <FormFeedback error={agentFeedback.error} success={agentFeedback.success} />

          <div>
            <Label htmlFor="agent-name">Agent name</Label>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              How the agent refers to itself in conversations. Does not change your Slack app&apos;s display name or icon.
            </p>
            <Input
              id="agent-name"
              value={agentNameValue}
              onChange={(e) => setAgentNameValue(e.target.value)}
              className="mt-1"
              maxLength={80}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="system-prompt">Role description</Label>
              <span className="text-xs tabular-nums text-[var(--fg-muted)]">
                {systemPromptValue.length}/{SYSTEM_PROMPT_MAX}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              The agent&apos;s core identity and responsibilities, injected at the top of every conversation.
            </p>
            <Textarea
              id="system-prompt"
              value={systemPromptValue}
              onChange={(e) =>
                setSystemPromptValue(e.target.value.slice(0, SYSTEM_PROMPT_MAX))
              }
              className="mt-1"
              rows={4}
              placeholder="You are the operations agent for this team."
            />
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Workspace ID"
        description="Reference this identifier when contacting support."
      >
        <CopyableId id={projectId} />
      </SettingsSectionCard>

      <p className="text-sm text-[var(--fg-muted)]">
        <Link href="/dashboard/team" className="text-[var(--accent)] hover:underline">
          Manage teammates →
        </Link>
      </p>
    </div>
  );
}
