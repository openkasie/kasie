import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isValidCron, nextAfter, parseCron } from "./cron.ts";

describe("parseCron validation", () => {
  const cases: Array<{ name: string; expr: string; valid: boolean }> = [
    { name: "every minute", expr: "* * * * *", valid: true },
    { name: "daily at 9", expr: "0 9 * * *", valid: true },
    { name: "weekly monday 9", expr: "0 9 * * 1", valid: true },
    { name: "every 15 minutes", expr: "*/15 * * * *", valid: true },
    { name: "range with step", expr: "0-30/10 9-17 * * 1-5", valid: true },
    { name: "list", expr: "0 9,17 * * *", valid: true },
    { name: "dow 7 is sunday", expr: "0 9 * * 7", valid: true },
    { name: "too few fields", expr: "0 9 * *", valid: false },
    { name: "too many fields", expr: "0 9 * * * *", valid: false },
    { name: "minute out of range", expr: "60 * * * *", valid: false },
    { name: "hour out of range", expr: "0 24 * * *", valid: false },
    { name: "dom zero", expr: "0 9 0 * *", valid: false },
    { name: "month 13", expr: "0 9 * 13 *", valid: false },
    { name: "dow 8", expr: "0 9 * * 8", valid: false },
    { name: "garbage", expr: "not a cron", valid: false },
    { name: "empty", expr: "", valid: false },
    { name: "zero step", expr: "*/0 * * * *", valid: false },
    { name: "inverted range", expr: "30-10 * * * *", valid: false },
    { name: "double slash", expr: "*/5/2 * * * *", valid: false },
  ];

  for (const c of cases) {
    test(c.name, () => {
      assert.equal(isValidCron(c.expr), c.valid, c.expr);
    });
  }
});

describe("parseCron field expansion", () => {
  test("step expands correctly", () => {
    const spec = parseCron("*/20 * * * *");
    assert.ok(spec);
    assert.deepEqual([...spec.minutes].sort((a, b) => a - b), [0, 20, 40]);
  });

  test("dow 7 normalizes to 0", () => {
    const spec = parseCron("0 9 * * 7");
    assert.ok(spec);
    assert.deepEqual([...spec.dows], [0]);
  });

  test("restriction flags", () => {
    const spec = parseCron("0 9 1 * 1");
    assert.ok(spec);
    assert.equal(spec.domRestricted, true);
    assert.equal(spec.dowRestricted, true);
  });
});

describe("nextAfter in UTC", () => {
  const cases: Array<{
    name: string;
    expr: string;
    from: string;
    expected: string | null;
  }> = [
    {
      name: "daily at 9, before 9",
      expr: "0 9 * * *",
      from: "2026-08-27T08:00:00Z",
      expected: "2026-08-27T09:00:00.000Z",
    },
    {
      name: "daily at 9, exactly 9 rolls to next day",
      expr: "0 9 * * *",
      from: "2026-08-27T09:00:00Z",
      expected: "2026-08-28T09:00:00.000Z",
    },
    {
      name: "every 15 minutes",
      expr: "*/15 * * * *",
      from: "2026-08-27T10:07:00Z",
      expected: "2026-08-27T10:15:00.000Z",
    },
    {
      name: "weekly monday 9 from thursday",
      expr: "0 9 * * 1",
      from: "2026-08-27T12:00:00Z", // Thursday
      expected: "2026-08-31T09:00:00.000Z", // Monday
    },
    {
      name: "sunday as 7",
      expr: "0 9 * * 7",
      from: "2026-08-27T12:00:00Z",
      expected: "2026-08-30T09:00:00.000Z",
    },
    {
      name: "monthly on the 1st",
      expr: "30 8 1 * *",
      from: "2026-08-27T12:00:00Z",
      expected: "2026-09-01T08:30:00.000Z",
    },
    {
      name: "every 6 hours",
      expr: "0 */6 * * *",
      from: "2026-08-27T13:00:00Z",
      expected: "2026-08-27T18:00:00.000Z",
    },
    {
      name: "dom OR dow when both restricted",
      expr: "0 9 15 * 1",
      from: "2026-08-27T12:00:00Z",
      // Monday Aug 31 comes before Sept 15
      expected: "2026-08-31T09:00:00.000Z",
    },
    {
      name: "year rollover",
      expr: "0 0 1 1 *",
      from: "2026-08-27T12:00:00Z",
      expected: "2027-01-01T00:00:00.000Z",
    },
    {
      name: "feb 29 resolves to next leap year",
      expr: "0 0 29 2 *",
      from: "2026-08-27T12:00:00Z",
      expected: "2028-02-29T00:00:00.000Z",
    },
    {
      name: "invalid expression",
      expr: "bogus",
      from: "2026-08-27T12:00:00Z",
      expected: null,
    },
    {
      name: "mid-minute from still lands on next boundary",
      expr: "* * * * *",
      from: "2026-08-27T12:00:30Z",
      expected: "2026-08-27T12:01:00.000Z",
    },
  ];

  for (const c of cases) {
    test(c.name, () => {
      const next = nextAfter(c.expr, new Date(c.from));
      assert.equal(next?.toISOString() ?? null, c.expected);
    });
  }
});

describe("nextAfter with timezones", () => {
  const cases: Array<{
    name: string;
    expr: string;
    timezone: string;
    from: string;
    expected: string;
  }> = [
    {
      name: "9am New York during EDT is 13:00 UTC",
      expr: "0 9 * * *",
      timezone: "America/New_York",
      from: "2026-08-27T00:00:00Z",
      expected: "2026-08-27T13:00:00.000Z",
    },
    {
      name: "9am New York during EST is 14:00 UTC",
      expr: "0 9 * * *",
      timezone: "America/New_York",
      from: "2026-12-10T00:00:00Z",
      expected: "2026-12-10T14:00:00.000Z",
    },
    {
      name: "spring-forward gap skips to next valid day",
      // 2:30 AM does not exist on 2026-03-08 in New York
      expr: "30 2 * * *",
      timezone: "America/New_York",
      from: "2026-03-08T00:00:00Z",
      expected: "2026-03-09T06:30:00.000Z", // 2:30 AM EDT next day
    },
    {
      name: "tokyo has no DST",
      expr: "0 9 * * *",
      timezone: "Asia/Tokyo",
      from: "2026-08-27T01:00:00Z", // 10:00 JST, past 9am
      expected: "2026-08-28T00:00:00.000Z", // next day 9:00 JST
    },
    {
      name: "weekly in timezone crosses UTC day boundary",
      expr: "0 22 * * 5", // Friday 10 PM Los Angeles
      timezone: "America/Los_Angeles",
      from: "2026-08-27T12:00:00Z", // Thursday
      expected: "2026-08-29T05:00:00.000Z", // Saturday 05:00 UTC
    },
  ];

  for (const c of cases) {
    test(c.name, () => {
      const next = nextAfter(c.expr, new Date(c.from), c.timezone);
      assert.equal(next?.toISOString() ?? null, c.expected);
    });
  }
});
