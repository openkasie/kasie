import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildAgentSystemPrompt } from "./system-prompt.ts";

const NOW = new Date("2026-08-27T09:00:00Z");

const base = {
  agentName: "Kasie",
  systemPrompt: "You are the operations agent for Acme.",
  personalityTone: "standard",
  workspaceInstructions: "Always cite sources.",
  now: NOW,
};

describe("buildAgentSystemPrompt", () => {
  test("includes identity, project prompt, coworker rules, and instructions", () => {
    const prompt = buildAgentSystemPrompt(base);
    assert.match(prompt, /You are Kasie, an AI coworker/);
    assert.match(prompt, /operations agent for Acme/);
    assert.match(prompt, /How you behave as a coworker:/);
    assert.match(prompt, /Answer the question first/);
    assert.match(prompt, /Always cite sources\./);
  });

  test("each tone expands into a style guide", () => {
    const tones: Record<string, RegExp> = {
      standard: /Voice: plain and direct/,
      friendly: /Voice: warm and casual/,
      concise: /Voice: minimal/,
      formal: /Voice: professional and measured/,
    };
    for (const [tone, pattern] of Object.entries(tones)) {
      assert.match(
        buildAgentSystemPrompt({ ...base, personalityTone: tone }),
        pattern,
        tone,
      );
    }
  });

  test("unknown tone falls back to standard", () => {
    assert.match(
      buildAgentSystemPrompt({ ...base, personalityTone: "sarcastic" }),
      /Voice: plain and direct/,
    );
  });

  test("current time renders in the configured timezone", () => {
    const prompt = buildAgentSystemPrompt({ ...base, timezone: "America/New_York" });
    assert.match(prompt, /Current time: Thursday, August 27, 2026 at 5:00 AM/);
  });

  test("invalid timezone falls back to ISO time", () => {
    const prompt = buildAgentSystemPrompt({ ...base, timezone: "Not/AZone" });
    assert.match(prompt, /Current time: 2026-08-27T09:00:00\.000Z/);
  });

  test("enabled skill presets are listed", () => {
    const prompt = buildAgentSystemPrompt({
      ...base,
      enabledSkillIds: ["release-notes"],
    });
    assert.match(prompt, /Enabled skill presets:/);
    assert.match(prompt, /Release notes/);
  });

  test("skill section omitted when nothing is enabled", () => {
    assert.doesNotMatch(
      buildAgentSystemPrompt({ ...base, enabledSkillIds: [] }),
      /Enabled skill presets:/,
    );
  });
});
