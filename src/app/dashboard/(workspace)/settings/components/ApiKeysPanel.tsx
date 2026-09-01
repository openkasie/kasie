"use client";

import { useState, useTransition } from "react";
import { KeyIcon } from "@phosphor-icons/react";
import {
  Button,
  Chip,
  EmptyState,
  FormFeedback,
  Input,
  Label,
  SettingsSectionCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/design-system";
import {
  createProjectApiKey,
  revokeProjectApiKey,
} from "../actions";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
};

type ApiKeysPanelProps = {
  keys: ApiKeyRow[];
  canManage: boolean;
};

export function ApiKeysPanel({ keys, canManage }: ApiKeysPanelProps) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error?: string }>({});
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFeedback({});
    setCreatedSecret(null);
    start(async () => {
      const result = await createProjectApiKey({ name });
      if (!result.ok) {
        setFeedback({ error: result.error });
        return;
      }
      setCreatedSecret(result.secret);
      setName("");
    });
  }

  function handleRevoke(keyId: string) {
    setFeedback({});
    start(async () => {
      const result = await revokeProjectApiKey(keyId);
      if (!result.ok) setFeedback({ error: result.error });
      setRevokeTarget(null);
    });
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);

  return (
    <div className="space-y-6">
      <FormFeedback error={feedback.error} />

      {createdSecret ? (
        <SettingsSectionCard
          title="Copy your new API key"
          description="This is the only time the full key is shown."
        >
          <code className="block break-all rounded-lg bg-[var(--surface-subtle)] px-3 py-2 text-xs">
            {createdSecret}
          </code>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 text-sm"
            onClick={() => navigator.clipboard.writeText(createdSecret)}
          >
            Copy to clipboard
          </Button>
        </SettingsSectionCard>
      ) : null}

      {canManage ? (
        <SettingsSectionCard
          title="API keys"
          description="Generate org-scoped keys for scripts and automations that call the agent API."
        >
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Label htmlFor="key-name">Label</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="CI pipeline"
                required
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={pending || !name.trim()}>
              Generate key
            </Button>
          </form>
        </SettingsSectionCard>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">
          Only organization owners can create or revoke API keys.
        </p>
      )}

      <SettingsSectionCard title="Existing API keys">
        {activeKeys.length === 0 ? (
          <EmptyState
            icon={<KeyIcon size={32} weight="regular" />}
            title="No API keys"
            description="Create a key to call the agent API from scripts or CI."
          />
        ) : (
          <Table>
            <TableHead>
              <TableHeaderCell>Label</TableHeaderCell>
              <TableHeaderCell>Key</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              {canManage ? <TableHeaderCell align="right">Actions</TableHeaderCell> : null}
            </TableHead>
            <TableBody>
              {activeKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-xs text-[var(--fg-muted)]">
                    {key.keyPrefix}…
                  </TableCell>
                  <TableCell>
                    <Chip variant="success">Active</Chip>
                  </TableCell>
                  {canManage ? (
                    <TableCell align="right">
                      {revokeTarget === key.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="danger"
                            className="text-sm"
                            disabled={pending}
                            onClick={() => handleRevoke(key.id)}
                          >
                            Confirm
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-sm"
                            disabled={pending}
                            onClick={() => setRevokeTarget(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-sm"
                          disabled={pending}
                          onClick={() => setRevokeTarget(key.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SettingsSectionCard>
    </div>
  );
}
