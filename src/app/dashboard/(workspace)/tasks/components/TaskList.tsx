"use client";

import { useState, useTransition } from "react";
import {
  CalendarCheckIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import {
  Button,
  Chip,
  EmptyState,
  GlassCard,
  PageHeader,
} from "@/design-system";
import { humanizeCron } from "@/lib/format";
import { toggleSchedule } from "../../actions";
import { TaskModal, type EditableSchedule } from "./TaskModal";

type TaskListProps = {
  schedules: EditableSchedule[];
};

export function TaskList({ schedules }: TaskListProps) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<EditableSchedule | null>(null);
  const [creating, setCreating] = useState(false);

  const modalOpen = creating || editing !== null;
  const closeModal = () => {
    setCreating(false);
    setEditing(null);
  };

  const newTaskButton = (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon size={16} /> New task
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Recurring jobs Kasie runs on a schedule and posts to Slack."
        actions={newTaskButton}
      />

      {schedules.length === 0 ? (
        <EmptyState
          icon={<CalendarCheckIcon size={32} weight="regular" />}
          title="No scheduled tasks yet"
          description="Create one from a template — a morning briefing, weekly digest, or anything you would ask Kasie to do on repeat."
        />
      ) : (
        <div className="space-y-2">
          {schedules.map((task) => (
            <GlassCard
              key={task.id}
              elevation="subtle"
              className="flex items-center justify-between gap-4 p-4"
            >
              <button
                type="button"
                onClick={() => setEditing(task)}
                className="min-w-0 flex-1 cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <p className="truncate font-medium">{task.title}</p>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">
                  {humanizeCron(task.cron)}
                  {task.timezone !== "UTC" ? ` · ${task.timezone}` : ""}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-3">
                <Chip variant={task.enabled ? "success" : "default"}>
                  {task.enabled ? "Active" : "Paused"}
                </Chip>
                <Button
                  variant="ghost"
                  disabled={pending}
                  aria-label={task.enabled ? "Pause task" : "Resume task"}
                  onClick={() =>
                    start(async () => {
                      await toggleSchedule(task.id, !task.enabled);
                    })
                  }
                >
                  {task.enabled ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <TaskModal
        key={editing?.id ?? "new"}
        open={modalOpen}
        onClose={closeModal}
        schedule={editing}
      />
    </div>
  );
}
