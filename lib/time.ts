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
