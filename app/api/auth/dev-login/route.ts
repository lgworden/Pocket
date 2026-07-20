import { NextRequest, NextResponse } from "next/server";
import { findOrCreateUserByEmail } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";

// Local-only shortcut to establish a session without Google's consent screen,
// so multi-user flows can be exercised in dev. Hard-disabled in production.
//   /api/auth/dev-login                → logs in as SEED_USER_EMAIL
//   /api/auth/dev-login?email=a@b.com  → logs in as (or creates) that user
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const email =
    req.nextUrl.searchParams.get("email") ||
    process.env.SEED_USER_EMAIL ||
    "me@closetstylist.app";
  const name = req.nextUrl.searchParams.get("name") || undefined;

  const userId = await findOrCreateUserByEmail({ email, name });
  setSessionCookie(userId);
  return NextResponse.redirect(`${req.nextUrl.origin}/`);
}
