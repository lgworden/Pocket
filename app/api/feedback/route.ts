import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { submitFeedback, SENTIMENTS, MAX_FEEDBACK_LENGTH, type Sentiment } from "@/lib/feedback";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      message?: unknown;
      sentiment?: unknown;
      source?: unknown;
    };

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "Say something first!" }, { status: 400 });
    }
    if (message.length > MAX_FEEDBACK_LENGTH) {
      return NextResponse.json(
        { error: `Keep it under ${MAX_FEEDBACK_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const sentiment =
      typeof body.sentiment === "string" && SENTIMENTS.includes(body.sentiment as Sentiment)
        ? (body.sentiment as Sentiment)
        : null;
    const source = typeof body.source === "string" ? body.source.slice(0, 64) : null;

    const { id } = await submitFeedback({ userId, message, sentiment, source });
    track(userId, "feedback_submitted", { feedbackId: id, sentiment, source });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("Failed to submit feedback:", err);
    return NextResponse.json({ error: "Couldn't send that — try again?" }, { status: 500 });
  }
}
