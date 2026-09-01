"use client";

import { useTransition } from "react";
import { UsersIcon } from "@phosphor-icons/react";
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  GlassCard,
  PageHeader,
} from "@/design-system";
import { removeTeamMember } from "../../actions";

type Member = {
  userId: string;
  role: string;
  name: string | null;
  email: string;
  image: string | null;
};

type TeamListProps = {
  orgId: string;
  members: Member[];
  currentUserId: string;
  isOwner: boolean;
};

export function TeamList({
  orgId,
  members,
  currentUserId,
  isOwner,
}: TeamListProps) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Everyone on your team. Invite teammates and manage their roles."
      />

      {members.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={32} weight="regular" />}
          title="No team members"
          description="This workspace is not linked to an organization yet."
        />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-[var(--fg-muted)]">
            {members.length} team member{members.length === 1 ? "" : "s"}
          </p>
          {members.map((member) => (
            <GlassCard
              key={member.userId}
              elevation="subtle"
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} image={member.image} />
                <div className="min-w-0">
                  <p className="font-medium">
                    {member.name ?? member.email}
                    {member.userId === currentUserId ? " (You)" : ""}
                  </p>
                  <p className="truncate text-sm text-[var(--fg-muted)]">
                    {member.email}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Chip variant={member.role === "owner" ? "info" : "default"}>
                  {member.role === "owner" ? "Admin" : "Member"}
                </Chip>
                {isOwner &&
                  member.userId !== currentUserId &&
                  member.role !== "owner" ? (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await removeTeamMember(orgId, member.userId);
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
