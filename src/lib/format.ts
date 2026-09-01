import { CENTS_TO_MICROS, USD_MICROS } from "@/lib/usage/cost";

export function formatUsdFromMicros(micros: number): string {
  const dollars = micros / USD_MICROS;
  if (micros === 0) return "$0.00";
  const fractionDigits = Math.abs(dollars) < 0.01 ? 6 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: fractionDigits,
  }).format(dollars);
}

export function formatUsdFromCents(cents: number): string {
  return formatUsdFromMicros(cents * CENTS_TO_MICROS);
}

export function formatRelativeTime(date: Date, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
  return date.toISOString().slice(0, 10);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

export function humanizeCron(cron: string) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [min, hour, dom, month, dow] = parts;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayLabel =
    dow === "*"
      ? "Every day"
      : dow === "1-5"
        ? "Every weekday"
        : days[Number(dow)]
          ? `Every ${days[Number(dow)]}`
          : `Day ${dow}`;

  if (dom === "*" && month === "*") {
    const minuteStep = min.match(/^\*\/(\d+)$/);
    if (minuteStep && hour === "*" && dow === "*") {
      return `Every ${minuteStep[1]} minutes`;
    }

    const hourStep = hour.match(/^\*\/(\d+)$/);
    if (hourStep && min === "0" && dow === "*") {
      return Number(hourStep[1]) === 1 ? "Every hour" : `Every ${hourStep[1]} hours`;
    }
  }

  if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const h = Number(hour);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mm = String(Number(min)).padStart(2, "0");
    return `${dayLabel} at ${h12}:${mm} ${ampm}`;
  }

  return cron;
}
