export const DEFAULT_REPORTING_TIMEZONE = "Australia/Sydney";
export const DISPLAY_TIMEZONE_BROWSER = "browser";
export const TIMEZONE_OPTIONS = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Asia/Manila",
  "UTC",
] as const;

export type DisplayTimezonePreference = typeof DISPLAY_TIMEZONE_BROWSER | (typeof TIMEZONE_OPTIONS)[number] | string;

type DateTimeValue = string | Date | null | undefined;
type SafeDateTimeOptions = Pick<
  Intl.DateTimeFormatOptions,
  | "weekday"
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "hour12"
  | "hourCycle"
  | "timeZoneName"
>;

const ALLOWED_DATE_TIME_OPTION_KEYS = [
  "weekday",
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
  "hour12",
  "hourCycle",
  "timeZoneName",
] as const;

export function isValidTimeZone(timeZone?: string | null) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function browserTimeZone() {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return detected && isValidTimeZone(detected) ? detected : DEFAULT_REPORTING_TIMEZONE;
}

export function safeTimeZone(timeZone?: string | null, fallback = DEFAULT_REPORTING_TIMEZONE) {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : fallback;
}

function sanitizeDateTimeOptions(input?: Record<string, unknown>): SafeDateTimeOptions {
  const safeOptions: Record<string, unknown> = {};
  for (const key of ALLOWED_DATE_TIME_OPTION_KEYS) {
    if (input && key in input) safeOptions[key] = input[key];
  }
  return safeOptions as SafeDateTimeOptions;
}

function safeDate(value: DateTimeValue) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    date: Number(parts.day),
    day: dayMap[parts.weekday] ?? 0,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetMsAt(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month, parts.date, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function zonedTimeToUtc(year: number, month: number, date: number, timeZone: string) {
  const zone = safeTimeZone(timeZone);
  let utc = Date.UTC(year, month, date, 0, 0, 0);
  for (let index = 0; index < 4; index += 1) {
    const next = Date.UTC(year, month, date, 0, 0, 0) - offsetMsAt(new Date(utc), zone);
    if (Math.abs(next - utc) < 1000) break;
    utc = next;
  }
  return new Date(utc);
}

export function timezoneRange(range: "today" | "week" | "month", timeZone: string) {
  const zone = safeTimeZone(timeZone);
  const parts = zonedParts(new Date(), zone);
  const startDay = range === "week" ? parts.date - parts.day : range === "month" ? 1 : parts.date;
  const start = zonedTimeToUtc(parts.year, parts.month, startDay, zone);
  const end =
    range === "today"
      ? zonedTimeToUtc(parts.year, parts.month, parts.date + 1, zone)
      : range === "week"
        ? zonedTimeToUtc(parts.year, parts.month, startDay + 7, zone)
        : zonedTimeToUtc(parts.year, parts.month + 1, 1, zone);
  return { start: start.toISOString(), end: end.toISOString(), timeZone: zone };
}

export function formatDateTime(
  value?: string | Date | null,
  timeZone = DEFAULT_REPORTING_TIMEZONE,
  formatOptions?: Record<string, unknown>,
) {
  const date = safeDate(value);
  if (!date) return "—";

  const zone = safeTimeZone(timeZone);
  const baseOptions: Intl.DateTimeFormatOptions = {
    timeZone: zone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  };

  try {
    return new Intl.DateTimeFormat("en-AU", {
      ...baseOptions,
      ...sanitizeDateTimeOptions(formatOptions),
    }).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat("en-AU", baseOptions).format(date);
    } catch {
      return date.toISOString();
    }
  }
}

export function formatDateOnly(value?: string | Date | null) {
  const date = typeof value === "string"
    ? (() => {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)) : safeDate(value);
      })()
    : safeDate(value);
  if (!date) return "—";

  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

