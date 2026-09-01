import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_WORKING_HOURS,
  evaluateInitiativeGate,
  INITIATIVE_IDLE_MS,
  INITIATIVE_MAX_PER_DAY,
  INITIATIVE_MIN_SPACING_MS,
  isWithinWorkingHours,
} from "./gates.ts";

// Thursday 09:00 UTC — inside default working hours (8-18 Mon-Fri).
const NOW = new Date("2026-08-27T09:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

const inHours = { timezone: "UTC", workingHours: null };

describe("evaluateInitiativeGate", () => {
  const cases: Array<{
    name: string;
    input: Omit<Parameters<typeof evaluateInitiativeGate>[0], "timezone" | "workingHours"> &
      Partial<Pick<Parameters<typeof evaluateInitiativeGate>[0], "timezone" | "workingHours">>;
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
    {
      name: "blocked at night even when otherwise idle",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: hoursAgo(30),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        now: new Date("2026-08-27T03:00:00Z"),
      },
      fire: false,
      reason: "outside_working_hours",
    },
    {
      name: "blocked on weekends",
      input: {
        proactiveEnabled: true,
        lastUserRunAt: hoursAgo(30),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        // Saturday 10:00 UTC
        now: new Date("2026-08-29T10:00:00Z"),
      },
      fire: false,
      reason: "outside_working_hours",
    },
    {
      name: "working hours respect the configured timezone",
      input: {
        proactiveEnabled: true,
        // Thursday 13:00 UTC = Thursday 22:00 in Tokyo — after hours there.
        timezone: "Asia/Tokyo",
        lastUserRunAt: hoursAgo(30),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        now: new Date("2026-08-27T13:00:00Z"),
      },
      fire: false,
      reason: "outside_working_hours",
    },
    {
      name: "custom working hours override the defaults",
      input: {
        proactiveEnabled: true,
        workingHours: { startHour: 0, endHour: 24, days: [0, 1, 2, 3, 4, 5, 6] },
        lastUserRunAt: hoursAgo(30),
        projectCreatedAt: hoursAgo(100),
        lastInitiativeAt: null,
        initiativesLast24h: 0,
        // Saturday 03:00 UTC — allowed by the custom always-on hours.
        now: new Date("2026-08-29T03:00:00Z"),
      },
      fire: true,
    },
  ];

  for (const c of cases) {
    test(c.name, () => {
      const result = evaluateInitiativeGate({ ...inHours, ...c.input });
      assert.equal(result.fire, c.fire);
      if (!result.fire && c.reason) assert.equal(result.reason, c.reason);
    });
  }
});

describe("isWithinWorkingHours", () => {
  const cases: Array<{
    name: string;
    now: Date;
    timezone: string;
    hours?: typeof DEFAULT_WORKING_HOURS;
    within: boolean;
  }> = [
    {
      name: "weekday morning UTC is within default hours",
      now: NOW,
      timezone: "UTC",
      within: true,
    },
    {
      name: "start hour is inclusive",
      now: new Date("2026-08-27T08:00:00Z"),
      timezone: "UTC",
      within: true,
    },
    {
      name: "end hour is exclusive",
      now: new Date("2026-08-27T18:00:00Z"),
      timezone: "UTC",
      within: false,
    },
    {
      name: "sunday is outside default hours",
      now: new Date("2026-08-30T10:00:00Z"),
      timezone: "UTC",
      within: false,
    },
    {
      name: "timezone shifts the local day",
      // Thursday 23:00 UTC = Friday 08:00 in Tokyo — a working hour there.
      now: new Date("2026-08-27T23:00:00Z"),
      timezone: "Asia/Tokyo",
      within: true,
    },
    {
      name: "invalid timezone falls back to UTC",
      now: NOW,
      timezone: "Not/AZone",
      within: true,
    },
  ];

  for (const c of cases) {
    test(c.name, () => {
      assert.equal(
        isWithinWorkingHours(c.now, c.timezone, c.hours ?? DEFAULT_WORKING_HOURS),
        c.within,
      );
    });
  }
});
