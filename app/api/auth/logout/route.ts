import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function GET(req: NextRequest) {
  clearSessionCookie();
  return NextResponse.redirect(`${req.nextUrl.origin}/login`);
}
