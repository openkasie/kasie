import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeRunCostMicros, utcMonthStart } from "./cost.ts";

const cases: Array<{
  name: string;
  tier: "balanced" | "smart" | "ultra";
  inputTokens: number;
  outputTokens: number;
  expected: number;
}> = [
  {
    name: "zero tokens costs nothing",
    tier: "smart",
    inputTokens: 0,
    outputTokens: 0,
    expected: 0,
  },
  {
    name: "balanced 1K input rounds to 150 micros",
    tier: "balanced",
    inputTokens: 1000,
    outputTokens: 0,
    expected: 150,
  },
  {
    name: "balanced 1K output rounds to 600 micros",
    tier: "balanced",
    inputTokens: 0,
    outputTokens: 1000,
    expected: 600,
  },
  {
    name: "smart 1K input is $0.0025",
    tier: "smart",
    inputTokens: 1000,
    outputTokens: 0,
    expected: 2500,
  },
  {
    name: "ultra 1K output is $0.015",
    tier: "ultra",
    inputTokens: 0,
    outputTokens: 1000,
    expected: 15_000,
  },
  {
    name: "smart mixed tokens ceil to micros",
    tier: "smart",
    inputTokens: 100,
    outputTokens: 50,
    expected: 750,
  },
  {
    name: "single balanced token ceils to 1 micro",
    tier: "balanced",
    inputTokens: 1,
    outputTokens: 0,
    expected: 1,
  },
];

describe("computeRunCostMicros", () => {
  for (const c of cases) {
    test(c.name, () => {
      assert.equal(
        computeRunCostMicros(c.tier, c.inputTokens, c.outputTokens),
        c.expected,
      );
    });
  }
});

describe("utcMonthStart", () => {
  test("returns the first of the month in UTC", () => {
    const start = utcMonthStart(new Date("2026-08-26T17:00:00.000Z"));
    assert.equal(start.toISOString(), "2026-08-01T00:00:00.000Z");
  });
});
