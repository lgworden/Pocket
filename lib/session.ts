import { cookies } from "next/headers";
import crypto from "crypto";

// Stateless, dependency-free sessions: an HTTP-only cookie holding the user id
// plus an HMAC signature over it. No sessions table to keep in sync; rotating
// SESSION_SECRET invalidates every outstanding session at once.
const COOKIE_NAME = "cs_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error(
      "SESSION_SECRET is not set. Add a random 32+ byte hex string to your env."
    );
  }
  return s;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

// Writable only from Route Handlers / Server Actions (not plain Server Components).
export function setSessionCookie(userId: string): void {
  cookies().set(COOKIE_NAME, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(COOKIE_NAME);
}

// Readable anywhere cookies() is (Server Components, Route Handlers).
// Returns the user id only if the signature verifies — a tampered or
// unsigned cookie reads as no session.
export function readSessionUserId(): string | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const userId = raw.slice(0, dot);
  const providedSig = raw.slice(dot + 1);
  const expectedSig = sign(userId);

  // timingSafeEqual throws on length mismatch — guard first.
  if (providedSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))) {
    return null;
  }
  return userId;
}
