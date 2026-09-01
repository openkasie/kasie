import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  evaluateInitiativeGate,
  INITIATIVE_IDLE_MS,
  INITIATIVE_MAX_PER_DAY,
  INITIATIVE_MIN_SPACING_MS,
} from "./gates.ts";

const NOW = new Date("2026-08-27T09:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

describe("evaluateInitiativeGate", () => {
  const cases: Array<{
    name: string;
    input: Parameters<typeof evaluateInitiativeGate>[0];
    fire: boolean;
    reason?: string;
  }> = [
    {
      name: "fires when idle overnight with no prior initiatives",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: hoursAgo(10),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        now: NOW,
      },
      fire: true,
    },
    {
      name: "blocked when proactive is disabled",
      input: {
        proactiveEnabled: false,
        lastUserRunAt: hoursAgo(10),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        now: NOW,
      },
      fire: false,
      reason: "proactive_disabled",
    },
    {
      name: "fresh workspace with no user runs idles from project creation",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: null,
        projectCreatedAt: hoursAgo(10),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        now: NOW,
      },
      fire: true,
    },
    {
      name: "brand new workspace is not immediately pinged",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: null,
        projectCreatedAt: hoursAgo(1),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        now: NOW,
      },
      fire: false,
      reason: "operator_active",
    },
    {
      name: "blocked while operator is active",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: hoursAgo(1),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        now: NOW,
      },
      fire: false,
      reason: "operator_active",
    },
    {
      name: "blocked exactly at the idle boundary minus one ms",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: new Date(NOW.getTime() - INITIATIVE_IDLE_MS + 1),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        now: NOW,
      },
      fire: false,
      reason: "operator_active",
    },
    {
      name: "fires exactly at the idle boundary",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: new Date(NOW.getTime() - INITIATIVE_IDLE_MS),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        now: NOW,
      },
      fire: true,
    },
    {
      name: "blocked at the daily cap",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: hoursAgo(10),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: hoursAgo(8),
        initiativesLast24h: INITIATIVE_MAX_PER_DAY,
        now: NOW,
      },
      fire: false,
      reason: "daily_cap_reached",
    },
    {
      name: "blocked too soon after the last initiative",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: hoursAgo(10),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: new Date(NOW.getTime() - INITIATIVE_MIN_SPACING_MS + 1),
        initiativesLast24h: 1,
        now: NOW,
      },
      fire: false,
      reason: "too_soon_after_last_initiative",
    },
    {
      name: "fires again once spacing has elapsed",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: hoursAgo(10),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: new Date(NOW.getTime() - INITIATIVE_MIN_SPACING_MS),
        initiativesLast24h: 1,
        now: NOW,
      },
      fire: true,
    },
  ];

  for (const c of cases) {
    test(c.name, () => {
      const result = evaluateInitiativeGate(c.input);
      assert.equal(result.fire, c.fire);
      if (!result.fire && c.reason) assert.equal(result.reason, c.reason);
    });
  }
});
