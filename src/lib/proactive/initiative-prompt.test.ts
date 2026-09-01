import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOTHING_TO_REPORT } from "./constants.ts";
import {
  buildInitiativePrompt,
  buildLooseEndsSection,
  type InitiativeLooseEnds,
} from "./initiative-prompt.ts";

const NOW = new Date("2026-09-01T12:00:00.000Z");

const EMPTY: InitiativeLooseEnds = {
  pendingApprovals: [],
  priorInitiatives: [],
  silentSchedules: [],
};

describe("buildLooseEndsSection", () => {
  it("returns an empty string when there is nothing outstanding", () => {
    assert.equal(buildLooseEndsSection(EMPTY, NOW), "");
  });

  it("lists pending approvals with tool name and age", () => {
    const section = buildLooseEndsSection(
      {
        ...EMPTY,
        pendingApprovals: [
          { toolName: "github_create_issue", createdAt: new Date("2026-09-01T09:00:00Z") },
          { toolName: "linear_update", createdAt: new Date("2026-08-29T12:00:00Z") },
        ],
      },
      NOW,
    );

    assert.match(section, /Loose ends:/);
    assert.match(section, /`github_create_issue`/);
    assert.match(section, /waiting 3h/);
    assert.match(section, /`linear_update`/);
    assert.match(section, /waiting 3d/);
  });

  it("describes fresh approvals as waiting under an hour", () => {
    const section = buildLooseEndsSection(
      {
        ...EMPTY,
        pendingApprovals: [
          { toolName: "slack_post", createdAt: new Date("2026-09-01T11:59:00Z") },
        ],
      },
      NOW,
    );
    assert.match(section, /waiting under an hour/);
  });

  it("flags silent schedules by title", () => {
    const section = buildLooseEndsSection(
      {
        ...EMPTY,
        silentSchedules: [{ title: "Morning digest" }, { title: null }],
      },
      NOW,
    );

    assert.match(section, /"Morning digest" has produced nothing/);
    assert.match(section, /"untitled" has produced nothing/);
    assert.match(section, /tuned or paused/);
  });

  it("lists prior initiative texts truncated to 300 chars", () => {
    const section = buildLooseEndsSection(
      { ...EMPTY, priorInitiatives: ["short update", "y".repeat(400)] },
      NOW,
    );

    assert.match(section, /do not repeat these/);
    assert.match(section, /- short update/);
    assert.match(section, new RegExp(`- y{300}(?!y)`));
  });
});

describe("buildInitiativePrompt", () => {
  it("includes recent messages, integrations, and the silence sentinel", () => {
    const prompt = buildInitiativePrompt({
      now: NOW,
      recentMessages: ["fix the billing bug"],
      integrationSlugs: ["github", "linear"],
    });

    assert.match(prompt, /- fix the billing bug/);
    assert.match(prompt, /Connected integrations: github, linear/);
    assert.ok(prompt.includes(NOTHING_TO_REPORT));
    assert.ok(!prompt.includes("Loose ends:"));
  });

  it("weaves the loose ends section between context and rules", () => {
    const prompt = buildInitiativePrompt({
      now: NOW,
      recentMessages: [],
      integrationSlugs: [],
      looseEnds: {
        pendingApprovals: [
          { toolName: "github_merge", createdAt: new Date("2026-09-01T10:00:00Z") },
        ],
        priorInitiatives: ["suggested cleaning up stale branches"],
        silentSchedules: [],
      },
    });

    const looseEndsAt = prompt.indexOf("Loose ends:");
    assert.ok(looseEndsAt > prompt.indexOf("Recent requests you handled:"));
    assert.ok(looseEndsAt < prompt.indexOf("Connected integrations:"));
    assert.match(prompt, /`github_merge`/);
    assert.match(prompt, /suggested cleaning up stale branches/);
  });

  it("omits the loose ends block entirely when empty", () => {
    const prompt = buildInitiativePrompt({
      now: NOW,
      recentMessages: [],
      integrationSlugs: [],
      looseEnds: EMPTY,
    });

    assert.ok(!prompt.includes("Loose ends:"));
    assert.ok(!prompt.includes("do not repeat these"));
  });
});
