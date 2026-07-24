// Small timezone helpers for the notification cron. The app is single-user
// (Washington DC per user.location) so "America/New_York" is a reasonable
// stand-in for "the user's timezone" until users.timezone becomes a real column.
export const DEFAULT_TIMEZONE = "America/New_York";

export function getCurrentHHMMInZone(tz: string = DEFAULT_TIMEZONE, date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function getCurrentWeekdayInZone(tz: string = DEFAULT_TIMEZONE, date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .format(date)
    .toLowerCase(); // "sun", "mon", ...
}

// "Good morning" / "Good afternoon" / "Good evening" for the Today screen's
// header. Zone-safe for the same reason as everything else in this file — the
// server's own clock (UTC on Railway) is not the user's local time of day.
export function getTimeOfDayGreeting(tz: string = DEFAULT_TIMEZONE, date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, hour: "2-digit" })
      .formatToParts(date)
      .find((p) => p.type === "hour")?.value ?? "0"
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Returns the [start, end) of "today" in `tz` as RFC3339 strings with an explicit
// UTC offset — safe to hand straight to an API's timeMin/timeMax (e.g. Google
// Calendar) regardless of what timezone the server process itself runs in.
// Railway containers default to UTC, not the user's zone, so computing "today"
// from the server's local clock (`new Date().getDate()` etc.) silently fetches
// the wrong day's window — this is the zone-safe replacement for that.
export function getZonedDayBoundsRFC3339(
  tz: string = DEFAULT_TIMEZONE,
  date = new Date()
): { timeMin: string; timeMax: string } {
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date); // "YYYY-MM-DD"

  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT-4"
  const match = offsetName?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] ?? "+";
  const hh = (match?.[2] ?? "0").padStart(2, "0");
  const mm = match?.[3] ?? "00";
  const offset = `${sign}${hh}:${mm}`;

  return {
    timeMin: `${dateStr}T00:00:00${offset}`,
    timeMax: `${dateStr}T23:59:59${offset}`,
  };
}

// Cron fires every ~15 minutes; a preferred "HH:mm" is "due" if it falls in the
// same windowMinutes-sized bucket as the current time, so each fire only
// matches the one bucket it's responsible for.
export function isTimeDue(preferredHHMM: string, nowHHMM: string, windowMinutes = 15): boolean {
  const [prefH, prefM] = preferredHHMM.split(":").map(Number);
  const [nowH, nowM] = nowHHMM.split(":").map(Number);
  if ([prefH, prefM, nowH, nowM].some((n) => Number.isNaN(n))) return false;

  const prefTotal = prefH * 60 + prefM;
  const nowTotal = nowH * 60 + nowM;
  const prefBucket = Math.floor(prefTotal / windowMinutes);
  const nowBucket = Math.floor(nowTotal / windowMinutes);
  return prefBucket === nowBucket;
}
