/**
 * Minimal 5-field cron (minute hour day-of-month month day-of-week) with
 * timezone-aware evaluation. Stdlib only: timezone math goes through
 * Intl.DateTimeFormat, so no dependency is needed.
 *
 * Supported syntax per field: `*`, numbers, lists (`1,15`), ranges (`1-5`),
 * and steps (`*\/15`, `1-30/5`). Day-of-week accepts 0-7 (both 0 and 7 are
 * Sunday). Standard cron semantics: when both day-of-month and day-of-week
 * are restricted, a day matches if either matches.
 */

export type CronSpec = {
  minutes: Set<number>;
  hours: Set<number>;
  doms: Set<number>;
  months: Set<number>;
  dows: Set<number>;
  domRestricted: boolean;
  dowRestricted: boolean;
};

type FieldRange = { min: number; max: number };

const FIELD_RANGES: FieldRange[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 7 }, // day of week (7 == 0 == Sunday)
];

function parseField(raw: string, range: FieldRange): Set<number> | null {
  const values = new Set<number>();

  for (const part of raw.split(",")) {
    const [body, stepRaw, extra] = part.split("/");
    if (extra !== undefined || body === "") return null;

    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step < 1) return null;

    let lo: number;
    let hi: number;
    if (body === "*") {
      lo = range.min;
      hi = range.max;
    } else if (body.includes("-")) {
      const [a, b, rest] = body.split("-");
      if (rest !== undefined) return null;
      lo = Number(a);
      hi = Number(b);
    } else {
      lo = Number(body);
      hi = stepRaw === undefined ? lo : range.max;
    }

    if (!Number.isInteger(lo) || !Number.isInteger(hi)) return null;
    if (lo < range.min || hi > range.max || lo > hi) return null;

    for (let v = lo; v <= hi; v += step) values.add(v);
  }

  return values.size > 0 ? values : null;
}

export function parseCron(expr: string): CronSpec | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const parsed = fields.map((f, i) => parseField(f, FIELD_RANGES[i]));
  if (parsed.some((p) => p === null)) return null;

  const [minutes, hours, doms, months, dowsRaw] = parsed as Set<number>[];

  const dows = new Set<number>();
  for (const d of dowsRaw) dows.add(d === 7 ? 0 : d);

  return {
    minutes,
    hours,
    doms,
    months,
    dows,
    domRestricted: fields[2] !== "*",
    dowRestricted: fields[4] !== "*",
  };
}

export function isValidCron(expr: string): boolean {
  return parseCron(expr) !== null;
}

type WallTime = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, fmt);
  }
  return fmt;
}

function wallTimeInZone(date: Date, timeZone: string): WallTime {
  const parts = zoneFormatter(timeZone).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function wallToUtcMillis(wall: WallTime): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
}

/**
 * Convert a wall-clock time in a timezone to UTC. Returns null for times that
 * do not exist (DST spring-forward gap); ambiguous times resolve to the
 * offset the iteration converges on.
 */
function wallTimeToUtc(wall: WallTime, timeZone: string): Date | null {
  const target = wallToUtcMillis(wall);
  let guess = target;

  for (let i = 0; i < 3; i++) {
    const observed = wallToUtcMillis(wallTimeInZone(new Date(guess), timeZone));
    const diff = target - observed;
    if (diff === 0) return new Date(guess);
    guess += diff;
  }
  return null;
}

function dayOfWeekUtc(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dayMatches(spec: CronSpec, year: number, month: number, day: number): boolean {
  if (!spec.months.has(month)) return false;

  const domOk = spec.doms.has(day);
  const dowOk = spec.dows.has(dayOfWeekUtc(year, month, day));

  if (spec.domRestricted && spec.dowRestricted) return domOk || dowOk;
  if (spec.domRestricted) return domOk;
  if (spec.dowRestricted) return dowOk;
  return true;
}

const MAX_SEARCH_DAYS = 366 * 4;

/**
 * Next occurrence of the cron expression strictly after `from`, evaluated in
 * the schedule's timezone. Returns null for invalid expressions or when no
 * occurrence exists within four years.
 */
export function nextAfter(expr: string, from: Date, timezone = "UTC"): Date | null {
  const spec = parseCron(expr);
  if (!spec) return null;

  const minutes = [...spec.minutes].sort((a, b) => a - b);
  const hours = [...spec.hours].sort((a, b) => a - b);

  const start = wallTimeInZone(new Date(from.getTime() + 60_000), timezone);
  let { year, month, day } = start;

  for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
    if (dayMatches(spec, year, month, day)) {
      const isStartDay =
        year === start.year && month === start.month && day === start.day;

      for (const hour of hours) {
        if (isStartDay && hour < start.hour) continue;
        for (const minute of minutes) {
          if (isStartDay && hour === start.hour && minute < start.minute) continue;
          const utc = wallTimeToUtc({ year, month, day, hour, minute }, timezone);
          if (utc && utc.getTime() > from.getTime()) return utc;
        }
      }
    }

    day++;
    if (day > daysInMonth(year, month)) {
      day = 1;
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  }

  return null;
}
