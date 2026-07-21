import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { generatePackingPlan } from "@/lib/packing";

// Pack My Bags: builds a 3-3-3 capsule + mix-and-match outfits for a trip.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json();

  try {
    const result = await generatePackingPlan(userId, {
      destination: body.destination ?? "",
      days: body.days ?? 1,
      activities: Array.isArray(body.activities) ? body.activities : [],
      notes: body.notes ?? "",
    });
    return NextResponse.json({ id: result.id, ...result.plan, weather: result.weather });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't pack your bags — try again?";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
