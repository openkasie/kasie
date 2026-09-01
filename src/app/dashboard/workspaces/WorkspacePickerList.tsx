"use client";

import { useTransition } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { GlassCard } from "@/design-system";
import { selectWorkspaceAndRedirect } from "../actions";

type Workspace = {
  id: string;
  name: string;
  agentName: string;
};

type WorkspacePickerListProps = {
  workspaces: Workspace[];
};

export function WorkspacePickerList({ workspaces }: WorkspacePickerListProps) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {workspaces.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await selectWorkspaceAndRedirect(p.id);
              })
            }
            className="text-left"
          >
            <GlassCard
              elevation="subtle"
              className="p-5 transition-shadow hover:ring-2 hover:ring-[var(--ring)]"
            >
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                Agent: {p.agentName}
              </p>
            </GlassCard>
          </button>
        ))}
      </div>

      <GlassCard
        elevation="subtle"
        className="flex items-center gap-3 border border-dashed border-[var(--border)] p-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-subtle)]">
          <PlusIcon size={20} className="text-[var(--fg-muted)]" />
        </span>
        <div>
          <p className="font-medium">Add workspace</p>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            New tenants are provisioned by an administrator. Contact your org
            owner to get access.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
