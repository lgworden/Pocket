import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  saveTokens,
  fetchGoogleUserInfo,
} from "@/lib/googleCalendar";
import { getSessionUserId, findOrCreateUserByEmail } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import pool from "@/lib/db";

// Shared callback for both Google flows. `state` disambiguates:
//   state=signin   → verify identity, provision/find the user, set a session
//   state=calendar → attach calendar tokens to the already-signed-in user
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const state = req.nextUrl.searchParams.get("state") ?? "signin";
  const baseUrl = req.nextUrl.origin;

  if (state === "calendar") {
    if (error || !code) return NextResponse.redirect(`${baseUrl}/?calendar=error`);
    try {
      const userId = await getSessionUserId();
      if (!userId) return NextResponse.redirect(`${baseUrl}/login`);
      const tokens = await exchangeCodeForTokens(code);
      await saveTokens(userId, tokens);
      return NextResponse.redirect(`${baseUrl}/?calendar=connected`);
    } catch {
      return NextResponse.redirect(`${baseUrl}/?calendar=error`);
    }
  }

  // Sign-in flow (state is "signin" or "signin:<inviteCode>")
  if (error || !code) return NextResponse.redirect(`${baseUrl}/login?error=denied`);
  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGoogleUserInfo(tokens.access_token);
    const userId = await findOrCreateUserByEmail(profile);
    setSessionCookie(userId);

    // Arrived via an invite link → finish accepting it (the invite page
    // completes the friendship, then continues to onboarding/home).
    const inviteCode = state.startsWith("signin:") ? state.slice("signin:".length) : null;
    if (inviteCode) {
      return NextResponse.redirect(`${baseUrl}/invite/${inviteCode}`);
    }

    // New users land in onboarding; returning users go home.
    const { rows } = await pool.query(
      "SELECT onboarding_completed FROM users WHERE id = $1",
      [userId]
    );
    const dest = rows[0]?.onboarding_completed ? "/" : "/onboarding";
    return NextResponse.redirect(`${baseUrl}${dest}`);
  } catch {
    return NextResponse.redirect(`${baseUrl}/login?error=signin`);
  }
}
