import { NextRequest, NextResponse } from "next/server";
import { createUserWithUsername } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import {
  hashPassword,
  normalizeUsername,
  validatePassword,
  validateUsername,
} from "@/lib/password";

// Username/password sign-up — the default way in, with Google Sign-In kept as
// a second option (see /login). Google is not required at any point: an account
// created here has no email and no calendar until the user opts into them.
export async function POST(req: NextRequest) {
  try {
    const { username: rawUsername, password, invite } = await req.json();

    if (typeof rawUsername !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Pick a username and password" }, { status: 400 });
    }

    const usernameError = validateUsername(rawUsername);
    if (usernameError) return NextResponse.json({ error: usernameError }, { status: 400 });

    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const username = normalizeUsername(rawUsername);
    const userId = await createUserWithUsername({
      username,
      passwordHash: await hashPassword(password),
    });

    if (!userId) {
      return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    }

    setSessionCookie(userId);

    // Arrived from an invite link → send them back to finish accepting it;
    // the invite page completes the friendship then continues to onboarding.
    const redirect =
      typeof invite === "string" && invite
        ? `/invite/${encodeURIComponent(invite)}`
        : "/onboarding";

    return NextResponse.json({ redirect });
  } catch (err) {
    console.error("[auth/register] failed:", err);
    return NextResponse.json({ error: "Couldn't create that account" }, { status: 500 });
  }
}
