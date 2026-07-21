import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { composeOutfitMockup, loadMockupItems } from "@/lib/mockup";

// Composes (or returns a cached) hand-drawn illustration of a whole recommended
// outfit from its pieces' photos. Called automatically by the Today screen for
// each outfit card once recommendations render — kept out of the recommendation
// request itself so text appears immediately and image generation never blocks it.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { display_ids } = await req.json();

  if (!Array.isArray(display_ids) || display_ids.length === 0) {
    return NextResponse.json({ error: "no items" }, { status: 400 });
  }

  try {
    const items = await loadMockupItems(userId, display_ids);
    const mockup = await composeOutfitMockup(userId, items);
    return NextResponse.json({ mockup });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't sketch this look — try again?";
    // 502 for provider/config failures so the client can surface the real reason.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
