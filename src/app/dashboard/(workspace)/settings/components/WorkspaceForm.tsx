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
} from "@/design-system";
import { updateWorkspaceIdentity } from "../../actions";

type WorkspaceFormProps = {
  name: string;
  projectId: string;
};

export function WorkspaceForm({ name, projectId }: WorkspaceFormProps) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [nameValue, setNameValue] = useState(name);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});

  const dirty = nameValue !== name;

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
