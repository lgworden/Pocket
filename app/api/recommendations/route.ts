import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { generateAndSaveRecommendation } from "@/lib/recommendations";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { dayText } = await req.json();

  const result = await generateAndSaveRecommendation(userId, dayText ?? "");

  return NextResponse.json(result);
}
