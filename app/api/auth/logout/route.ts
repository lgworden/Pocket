import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function GET(req: NextRequest) {
  clearSessionCookie();
  // req.nextUrl.origin reflects Railway's internal address, not the public
  // domain — same issue lib/friends.ts already works around for invite links.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return NextResponse.redirect(`${proto}://${host}/login`);
}
