import pool from "./db";
import { DEFAULT_TIMEZONE, getZonedDayBoundsRFC3339 } from "./time";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  token_type: string;
};

type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expiry_date: number; // epoch ms
};

// Calendar connect: heavier calendar.readonly scope, offline access for a refresh
// token. state=calendar so the shared callback knows to store tokens, not sign in.
export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    redirect_uri: REDIRECT_URI ?? "",
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: "calendar",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Sign-in: minimal identity scopes only (no calendar consent at the door).
// state=signin so the shared callback provisions a session instead of storing tokens.
const SIGNIN_SCOPE = "openid email profile";
// An optional invite code rides along in `state` so the callback can complete
// the friendship right after provisioning the account.
export function getGoogleSignInUrl(inviteCode?: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    redirect_uri: REDIRECT_URI ?? "",
    response_type: "code",
    scope: SIGNIN_SCOPE,
    access_type: "online",
    prompt: "select_account",
    state: inviteCode ? `signin:${inviteCode}` : "signin",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange a sign-in access token for the verified email + name.
export async function fetchGoogleUserInfo(
  accessToken: string
): Promise<{ email: string; name?: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo fetch failed: ${await res.text()}`);
  const data = await res.json();
  if (!data.email) throw new Error("Google userinfo returned no email");
  return { email: data.email, name: data.name };
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  // Diagnostic only — never logs the actual secret, just whether it's present
  // and its shape, to tell "unset" apart from "set but malformed" in Railway.
  console.log(
    `[googleCalendar] client_id=${CLIENT_ID ? `len ${CLIENT_ID.length}` : "MISSING"} ` +
      `client_secret=${
        CLIENT_SECRET ? `len ${CLIENT_SECRET.length}, trimmed len ${CLIENT_SECRET.trim().length}` : "MISSING"
      } redirect_uri=${REDIRECT_URI ?? "MISSING"}`
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      redirect_uri: REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function saveTokens(userId: string, tokens: TokenResponse): Promise<void> {
  const { rows } = await pool.query("SELECT google_calendar FROM users WHERE id = $1", [userId]);
  const existing: Partial<StoredTokens> = rows[0]?.google_calendar ?? {};

  const merged: StoredTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? existing.refresh_token ?? "",
    expiry_date: Date.now() + tokens.expires_in * 1000,
  };
  await pool.query("UPDATE users SET google_calendar = $1 WHERE id = $2", [
    JSON.stringify(merged),
    userId,
  ]);
}

export async function isCalendarConnected(userId: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT google_calendar FROM users WHERE id = $1", [userId]);
  return Boolean((rows[0]?.google_calendar as StoredTokens | null)?.refresh_token);
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const { rows } = await pool.query("SELECT google_calendar FROM users WHERE id = $1", [userId]);
  const tokens = rows[0]?.google_calendar as StoredTokens | null;
  if (!tokens?.refresh_token) return null;

  if (tokens.expiry_date > Date.now() + 60_000) {
    return tokens.access_token;
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  await saveTokens(userId, refreshed);
  return refreshed.access_token;
}

// calendar.readonly grants access to every calendar the user has, not just "primary" —
// enumerate them so events on secondary/work/shared calendars aren't silently missed.
async function getUserCalendarIds(accessToken: string): Promise<string[]> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Google calendar list fetch failed: ${await res.text()}`);
  const data = await res.json();
  type CalendarListEntry = { id: string };
  return (data.items ?? []).map((c: CalendarListEntry) => c.id);
}

export type CalendarEventDetail = {
  summary: string;
  location: string | null;
  start: string | null; // ISO dateTime; null for all-day events
  end: string | null;
};

async function getEventsForCalendar(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEventDetail[]> {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime" });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return []; // skip calendars we can't read rather than failing the whole batch

  type GoogleEvent = {
    status?: string;
    summary?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  };
  const data = await res.json();
  const items: GoogleEvent[] = data.items ?? [];

  return items
    .filter((e) => e.status !== "cancelled" && (e.summary || e.start))
    .map((e) => ({
      summary: e.summary ?? "(untitled event)",
      location: e.location?.trim() || null,
      start: e.start?.dateTime ?? null,
      end: e.end?.dateTime ?? null,
    }));
}

// Returns null if the user hasn't connected a calendar; throws if the fetch itself fails
// (expired/revoked grant) so callers can decide how to degrade.
export async function getTodayEventsDetailed(userId: string): Promise<CalendarEventDetail[] | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  // Zone-safe "today" — the server process (Railway) runs in UTC, not the
  // user's timezone, so this must not be derived from the server's local clock.
  const { timeMin, timeMax } = getZonedDayBoundsRFC3339();

  const calendarIds = await getUserCalendarIds(accessToken);
  const eventLists = await Promise.all(
    calendarIds.map((id) => getEventsForCalendar(accessToken, id, timeMin, timeMax))
  );

  return eventLists.flat().sort((a, b) => {
    if (!a.start) return -1;
    if (!b.start) return 1;
    return a.start.localeCompare(b.start);
  });
}

// Back-compat flattened form for callers that just want a display string per event:
// "Title - 9:00 AM" for timed events, "Title - all day" for all-day ones. Formats
// the time in the user's zone explicitly — the server's own clock is UTC on
// Railway, so leaving the zone implicit would print the wrong time (same class of
// bug getZonedDayBoundsRFC3339 above fixes for the fetch window itself).
export async function getTodayEventsSummary(userId: string): Promise<string[] | null> {
  const events = await getTodayEventsDetailed(userId);
  if (events === null) return null;

  return events.map((e) => {
    const time = e.start
      ? new Date(e.start).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          timeZone: DEFAULT_TIMEZONE,
        })
      : "all day";
    return `${e.summary} - ${time}`;
  });
}
