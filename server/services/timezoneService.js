export const DEFAULT_REPORTING_TIMEZONE = "Australia/Sydney";
export const TIMEZONE_OPTIONS = new Set([
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Asia/Manila",
  "UTC",
]);

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function safeTimeZone(timeZone, fallback = DEFAULT_REPORTING_TIMEZONE) {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : fallback;
}

function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
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
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
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

function offsetMsAt(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month, parts.date, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function zonedTimeToUtc(year, month, date, timeZone) {
  const zone = safeTimeZone(timeZone);
  let utc = Date.UTC(year, month, date, 0, 0, 0);
  for (let index = 0; index < 4; index += 1) {
    const next = Date.UTC(year, month, date, 0, 0, 0) - offsetMsAt(new Date(utc), zone);
    if (Math.abs(next - utc) < 1000) break;
    utc = next;
  }
  return new Date(utc);
}

export function timezoneRange(range = "today", timeZone = DEFAULT_REPORTING_TIMEZONE) {
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

export function zonedDateKey(timeZone = DEFAULT_REPORTING_TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
