import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getTodayEventsSummary } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  try {
    const events = await getTodayEventsSummary(userId);
    return NextResponse.json({ connected: events !== null, events: events ?? [] });
  } catch {
    return NextResponse.json({ connected: true, events: [], error: "Couldn't reach Google Calendar" });
  }
}
