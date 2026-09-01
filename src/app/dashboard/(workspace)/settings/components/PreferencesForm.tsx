"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  FormFeedback,
  Label,
  ModelTierCard,
  Select,
  SettingsSectionCard,
  Textarea,
} from "@/design-system";
import { updateProjectConfig } from "../../actions";
import type { ConfigUpdate } from "../../schemas";
import {
  INSTRUCTION_EXAMPLES,
  INSTRUCTIONS_MAX,
  type ModelTierPreset,
} from "../preferences.constants";

type PreferencesFormProps = {
  tone: string;
  instructions: string;
  modelTier: string;
  tierPresets: ModelTierPreset[];
};

export function PreferencesForm({
  tone,
  instructions,
  modelTier,
  tierPresets,
}: PreferencesFormProps) {
  const [pending, start] = useTransition();
  const [tierPending, startTier] = useTransition();
  const router = useRouter();
  const [toneValue, setToneValue] = useState(tone);
  const [instructionsValue, setInstructionsValue] = useState(instructions);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [tierFeedback, setTierFeedback] = useState<{ error?: string }>({});

  const dirty =
    toneValue !== tone || instructionsValue !== instructions;

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
    </div>
  );
}
