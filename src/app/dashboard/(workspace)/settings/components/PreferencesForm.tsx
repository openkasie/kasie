"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  FormFeedback,
  Input,
  Label,
  ModelTierCard,
  Select,
  SettingsSectionCard,
  Switch,
  Textarea,
} from "@/design-system";
import { updateProjectConfig } from "../../actions";
import type { ConfigUpdate } from "../../schemas";
import {
  INSTRUCTION_EXAMPLES,
  INSTRUCTIONS_MAX,
  type ModelTierPreset,
} from "../preferences.constants";

type WorkingHours = { startHour: number; endHour: number; days: number[] };

const DEFAULT_HOURS: WorkingHours = { startHour: 8, endHour: 18, days: [1, 2, 3, 4, 5] };
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PreferencesFormProps = {
  tone: string;
  instructions: string;
  modelTier: string;
  tierPresets: ModelTierPreset[];
  proactiveEnabled: boolean;
  timezone: string;
  workingHours: WorkingHours | null;
};

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function PreferencesForm({
  tone,
  instructions,
  modelTier,
  tierPresets,
  proactiveEnabled,
  timezone,
  workingHours,
}: PreferencesFormProps) {
  const [pending, start] = useTransition();
  const [tierPending, startTier] = useTransition();
  const [proactivePending, startProactive] = useTransition();
  const router = useRouter();
  const [toneValue, setToneValue] = useState(tone);
  const [instructionsValue, setInstructionsValue] = useState(instructions);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [tierFeedback, setTierFeedback] = useState<{ error?: string }>({});
  const [proactiveValue, setProactiveValue] = useState(proactiveEnabled);
  const [timezoneValue, setTimezoneValue] = useState(timezone);
  const [hoursValue, setHoursValue] = useState<WorkingHours>(workingHours ?? DEFAULT_HOURS);
  const [proactiveFeedback, setProactiveFeedback] = useState<{
    error?: string;
    success?: string;
  }>({});

  const dirty =
    toneValue !== tone || instructionsValue !== instructions;

  const baseHours = workingHours ?? DEFAULT_HOURS;
  const proactiveDirty =
    timezoneValue !== timezone ||
    hoursValue.startHour !== baseHours.startHour ||
    hoursValue.endHour !== baseHours.endHour ||
    hoursValue.days.join(",") !== baseHours.days.join(",");

  const charCount = instructionsValue.length;

  const savePersonality = () => {
    setFeedback({});
    start(async () => {
      const result = await updateProjectConfig({
        personalityTone: toneValue as ConfigUpdate["personalityTone"],
        workspaceInstructions: instructionsValue,
      });
      if (!result.ok) setFeedback({ error: result.error });
      else {
        setFeedback({ success: "Changes saved." });
        router.refresh();
      }
    });
  };

  const toggleProactive = (enabled: boolean) => {
    setProactiveValue(enabled);
    setProactiveFeedback({});
    startProactive(async () => {
      const result = await updateProjectConfig({ proactiveEnabled: enabled });
      if (!result.ok) {
        setProactiveValue(!enabled);
        setProactiveFeedback({ error: result.error });
      } else router.refresh();
    });
  };

  const toggleDay = (day: number) => {
    setHoursValue((h) => {
      const days = h.days.includes(day)
        ? h.days.filter((d) => d !== day)
        : [...h.days, day].sort((a, b) => a - b);
      return { ...h, days };
    });
  };

  const saveProactive = () => {
    setProactiveFeedback({});
    if (hoursValue.days.length === 0) {
      setProactiveFeedback({ error: "Select at least one workday." });
      return;
    }
    if (hoursValue.startHour >= hoursValue.endHour) {
      setProactiveFeedback({ error: "Workday start must be before end." });
      return;
    }
    startProactive(async () => {
      const result = await updateProjectConfig({
        timezone: timezoneValue,
        workingHours: hoursValue,
      });
      if (!result.ok) setProactiveFeedback({ error: result.error });
      else {
        setProactiveFeedback({ success: "Working hours saved." });
        router.refresh();
      }
    });
  };

  const selectTier = (tier: ConfigUpdate["modelTier"]) => {
    setTierFeedback({});
    startTier(async () => {
      const result = await updateProjectConfig({ modelTier: tier });
      if (!result.ok) setTierFeedback({ error: result.error });
      else router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        title="Personalization"
        description="Choose a default tone and add workspace instructions for your agent."
        footer={
          <Button type="button" disabled={pending || !dirty} onClick={savePersonality}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        }
      >
        <div className="space-y-4">
          <FormFeedback error={feedback.error} success={feedback.success} />

          <div>
            <Label htmlFor="tone">Employee personality</Label>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              Choose a default tone for agent responses.
            </p>
            <Select
              id="tone"
              name="tone"
              value={toneValue}
              onChange={(e) => setToneValue(e.target.value)}
              className="mt-1"
            >
              <option value="standard">Standard</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
              <option value="formal">Formal</option>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="instructions">Workspace instructions</Label>
              <span className="text-xs tabular-nums text-[var(--fg-muted)]">
                {charCount}/{INSTRUCTIONS_MAX}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              Standing directives injected into every conversation.
            </p>
            <Textarea
              id="instructions"
              name="instructions"
              value={instructionsValue}
              onChange={(e) =>
                setInstructionsValue(e.target.value.slice(0, INSTRUCTIONS_MAX))
              }
              className="mt-1"
              rows={6}
              placeholder="Add custom instructions here."
            />
            <details className="mt-2 text-xs text-[var(--fg-muted)]">
              <summary className="cursor-pointer hover:text-[var(--fg)]">Examples</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[var(--surface-subtle)] p-3 font-sans">
                {INSTRUCTION_EXAMPLES}
              </pre>
            </details>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Default model"
        description="Used for conversations and scheduled tasks. Higher tiers cost more API spend."
      >
        <FormFeedback error={tierFeedback.error} />

        <div
          role="radiogroup"
          aria-label="Default model tier"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {tierPresets.map((t) => (
            <ModelTierCard
              key={t.tier}
              tier={t.tier}
              label={t.label}
              description={t.description}
              specs={t.specs}
              recommended={t.recommended}
              selected={modelTier === t.tier}
              pending={tierPending}
              onSelect={() => selectTier(t.tier)}
            />
          ))}
        </div>

        <p className="mt-4 text-xs text-[var(--fg-muted)]">
          Cost labels are estimates relative to Smart. Actual spend is tracked on the Usage page.
        </p>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Proactive behavior"
        description="When your agent may reach out on its own, and the hours it treats as the team's workday."
        footer={
          <Button
            type="button"
            disabled={proactivePending || !proactiveDirty}
            onClick={saveProactive}
          >
            {proactivePending ? "Saving..." : "Save working hours"}
          </Button>
        }
      >
        <div className="space-y-4">
          <FormFeedback
            error={proactiveFeedback.error}
            success={proactiveFeedback.success}
          />

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="proactive-toggle">Self-directed updates</Label>
              <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                Allow the agent to send unprompted suggestions and digests when the team has been away.
              </p>
            </div>
            <Switch
              id="proactive-toggle"
              checked={proactiveValue}
              onCheckedChange={toggleProactive}
              disabled={proactivePending}
              aria-label="Toggle self-directed updates"
            />
          </div>

          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              IANA timezone the team operates in, e.g. America/New_York.
            </p>
            <Input
              id="timezone"
              value={timezoneValue}
              onChange={(e) => setTimezoneValue(e.target.value)}
              className="mt-1"
              maxLength={64}
              placeholder="UTC"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="work-start">Workday starts</Label>
              <Select
                id="work-start"
                value={String(hoursValue.startHour)}
                onChange={(e) =>
                  setHoursValue((h) => ({ ...h, startHour: Number(e.target.value) }))
                }
                className="mt-1"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatHour(i)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="work-end">Workday ends</Label>
              <Select
                id="work-end"
                value={String(hoursValue.endHour)}
                onChange={(e) =>
                  setHoursValue((h) => ({ ...h, endHour: Number(e.target.value) }))
                }
                className="mt-1"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {formatHour(i + 1)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Workdays</Label>
            <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Workdays">
              {DAY_LABELS.map((label, day) => {
                const active = hoursValue.days.includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDay(day)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[var(--fg-muted)]">
              Unprompted messages are held outside these hours. Scheduled tasks run at the times you set for them.
            </p>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
