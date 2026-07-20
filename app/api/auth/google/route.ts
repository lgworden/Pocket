import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl, getGoogleSignInUrl } from "@/lib/googleCalendar";

// /api/auth/google            → sign in with Google (default)
// /api/auth/google?mode=calendar → connect calendar for the signed-in user
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode");
  const invite = req.nextUrl.searchParams.get("invite") ?? undefined;
  const url = mode === "calendar" ? getGoogleAuthUrl() : getGoogleSignInUrl(invite);
  return NextResponse.redirect(url);
}
