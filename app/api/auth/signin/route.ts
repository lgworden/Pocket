import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { findUserByUsername } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { verifyPassword } from "@/lib/password";

// Username/password sign-in. Both "no such username" and "wrong password"
// return the same message so this can't be used to enumerate who has an
// account — usernames are semi-public (friend search), passwords are not.
const INVALID = "That username and password don't match";

export async function POST(req: NextRequest) {
  try {
    const { username, password, invite } = await req.json();

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    const user = await findUserByUsername(username);
    // verifyPassword returns false for a null hash, so a Google-provisioned
    // account (which has no password) falls through to the same error.
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    setSessionCookie(user.id);

    if (typeof invite === "string" && invite) {
      return NextResponse.json({ redirect: `/invite/${encodeURIComponent(invite)}` });
    }

    const { rows } = await pool.query(
      "SELECT onboarding_completed FROM users WHERE id = $1",
      [user.id]
    );
    return NextResponse.json({
      redirect: rows[0]?.onboarding_completed ? "/" : "/onboarding",
    });
  } catch (err) {
    console.error("[auth/signin] failed:", err);
    return NextResponse.json({ error: "Couldn't sign you in" }, { status: 500 });
  }
}
