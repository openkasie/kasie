"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeftIcon, CaretRightIcon, ClockIcon } from "@phosphor-icons/react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/design-system";
import { humanizeCron } from "@/lib/format";
import { removeSchedule, saveSchedule } from "../../actions";
import { TASK_TEMPLATES, type TaskTemplate } from "../templates";

export type EditableSchedule = {
  id: string;
  title: string;
  cron: string;
  timezone: string;
  prompt: string;
  channel: string | null;
  enabled: boolean;
};

type TaskModalProps = {
  open: boolean;
  onClose: () => void;
  schedule: EditableSchedule | null;
};

type Pattern = "daily" | "weekdays" | "weekly" | "hourly" | "custom";

type FormState = {
  title: string;
  prompt: string;
  pattern: Pattern;
  time: string; // HH:MM
  dayOfWeek: string; // 0-6
  everyHours: string;
  customCron: string;
  timezone: string;
  channel: string;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const HOUR_INTERVALS = ["1", "2", "3", "4", "6", "8", "12"];

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function timezoneOptions(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

function compileCron(form: FormState): string {
  const [hh = "9", mm = "0"] = form.time.split(":");
  const minute = String(Number(mm));
  const hour = String(Number(hh));

  switch (form.pattern) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekdays":
      return `${minute} ${hour} * * 1-5`;
    case "weekly":
      return `${minute} ${hour} * * ${form.dayOfWeek}`;
    case "hourly":
      return Number(form.everyHours) === 1
        ? "0 * * * *"
        : `0 */${form.everyHours} * * *`;
    case "custom":
      return form.customCron.trim();
  }
}

/** Map an existing cron back onto the builder; unknown shapes fall to custom. */
function formFromSchedule(schedule: EditableSchedule): FormState {
  const base: FormState = {
    title: schedule.title,
    prompt: schedule.prompt,
    pattern: "custom",
    time: "09:00",
    dayOfWeek: "1",
    everyHours: "6",
    customCron: schedule.cron,
    timezone: schedule.timezone,
    channel: schedule.channel ?? "",
  };

  const atTime = schedule.cron.match(/^(\d+) (\d+) \* \* (\*|1-5|[0-6])$/);
  if (atTime) {
    const [, minute, hour, dow] = atTime;
    base.time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    if (dow === "*") base.pattern = "daily";
    else if (dow === "1-5") base.pattern = "weekdays";
    else {
      base.pattern = "weekly";
      base.dayOfWeek = dow;
    }
    return base;
  }

  const hourly = schedule.cron.match(/^0 \*(?:\/(\d+))? \* \* \*$/);
  if (hourly && HOUR_INTERVALS.includes(hourly[1] ?? "1")) {
    base.pattern = "hourly";
    base.everyHours = hourly[1] ?? "1";
    return base;
  }

  return base;
}

function formFromTemplate(template: TaskTemplate): FormState {
  return formFromSchedule({
    id: "",
    title: template.label,
    prompt: template.prompt,
    cron: template.cron,
    timezone: browserTimezone(),
    channel: null,
    enabled: true,
  });
}

function emptyForm(): FormState {
  return {
    title: "",
    prompt: "",
    pattern: "daily",
    time: "09:00",
    dayOfWeek: "1",
    everyHours: "6",
    customCron: "0 9 * * *",
    timezone: browserTimezone(),
    channel: "",
  };
}

export function TaskModal({ open, onClose, schedule }: TaskModalProps) {
  const [form, setForm] = useState<FormState | null>(
    schedule ? formFromSchedule(schedule) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timezones = useMemo(() => timezoneOptions(), []);

  const isEditing = Boolean(schedule);
  const showTemplates = !isEditing && form === null;
  const cron = form ? compileCron(form) : "";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const close = () => {
    setForm(schedule ? formFromSchedule(schedule) : null);
    setError(null);
    onClose();
  };

  const submit = () => {
    if (!form) return;
    start(async () => {
      const result = await saveSchedule({
        scheduleId: schedule?.id,
        title: form.title,
        prompt: form.prompt,
        cron,
        timezone: form.timezone,
        channel: form.channel,
        enabled: schedule?.enabled ?? true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
    });
  };

  const destroy = () => {
    if (!schedule) return;
    start(async () => {
      const result = await removeSchedule({ scheduleId: schedule.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={showTemplates ? "New task" : isEditing ? "Edit task" : "Create a task"}
      description={
        showTemplates
          ? "Start from a template, or create your own. Kasie runs it on the schedule you set."
          : "Kasie runs this on the schedule you set and posts the result in Slack."
      }
      showClose
    >
      {showTemplates ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {TASK_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setForm(formFromTemplate(template))}
                className="group flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--border-elevated)] hover:bg-[var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <span className="min-w-0 space-y-1">
                  <span className="block text-sm font-medium">{template.label}</span>
                  <span className="block text-xs text-[var(--fg-muted)]">
                    {template.description}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                    <ClockIcon size={12} />
                    {humanizeCron(template.cron)}
                  </span>
                </span>
                <CaretRightIcon
                  size={16}
                  className="mt-0.5 shrink-0 text-[var(--fg-muted)] transition-transform group-hover:translate-x-0.5"
                />
              </button>
            ))}
          </div>
          <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4">
            <Button variant="secondary" onClick={() => setForm(emptyForm())}>
              Create manually
            </Button>
          </div>
        </div>
      ) : form ? (
        <div className="space-y-4">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setForm(null)}
              className="flex cursor-pointer items-center gap-1 text-xs text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
            >
              <ArrowLeftIcon size={12} /> Templates
            </button>
          ) : null}

          <Field label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Morning inbox summary"
              maxLength={120}
            />
          </Field>

          <Field
            label="Prompt"
            hint="What should Kasie do? Add any context and sources."
            required
          >
            <Textarea
              value={form.prompt}
              onChange={(e) => set("prompt", e.target.value)}
              rows={4}
              maxLength={4000}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Schedule">
              <Select
                value={form.pattern}
                onChange={(e) => set("pattern", e.target.value as Pattern)}
              >
                <option value="daily">Daily at time</option>
                <option value="weekdays">Weekdays at time</option>
                <option value="weekly">Weekly on day</option>
                <option value="hourly">Every N hours</option>
                <option value="custom">Custom cron</option>
              </Select>
            </Field>

            {form.pattern === "weekly" ? (
              <Field label="Day">
                <Select
                  value={form.dayOfWeek}
                  onChange={(e) => set("dayOfWeek", e.target.value)}
                >
                  {DAYS.map((day, i) => (
                    <option key={day} value={String(i)}>
                      {day}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {form.pattern === "hourly" ? (
              <Field label="Interval">
                <Select
                  value={form.everyHours}
                  onChange={(e) => set("everyHours", e.target.value)}
                >
                  {HOUR_INTERVALS.map((h) => (
                    <option key={h} value={h}>
                      Every {h} hour{h === "1" ? "" : "s"}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {form.pattern === "custom" ? (
              <Field label="Cron expression" hint="minute hour day month weekday">
                <Input
                  value={form.customCron}
                  onChange={(e) => set("customCron", e.target.value)}
                  placeholder="0 9 * * 1-5"
                />
              </Field>
            ) : null}

            {form.pattern === "daily" ||
            form.pattern === "weekdays" ||
            form.pattern === "weekly" ? (
              <Field label="At time">
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </Field>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-[var(--fg-muted)]">
              <ClockIcon size={14} />
              {humanizeCron(cron)}
            </span>
            <Select
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              className="w-56"
              aria-label="Timezone"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>

          <Field
            label="Post results to"
            hint="Slack channel ID (e.g. C0123456789). Leave empty to DM you."
          >
            <Input
              value={form.channel}
              onChange={(e) => set("channel", e.target.value)}
              placeholder="DM me"
              maxLength={64}
            />
          </Field>

          {error ? (
            <p role="alert" className="text-sm font-medium text-[var(--danger-fg)]">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
            {isEditing ? (
              <Button variant="danger" disabled={pending} onClick={destroy}>
                Delete task
              </Button>
            ) : (
              <span />
            )}
            <Button
              disabled={pending || !form.title.trim() || !form.prompt.trim()}
              onClick={submit}
            >
              {isEditing ? "Save changes" : "Create task"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
