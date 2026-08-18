import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { emailPackingPlan, isValidEmail } from "@/lib/packEmail";
import { isEmailConfigured } from "@/lib/email";

// Mails a saved packing plan to the user as a PCKT AIRWAYS boarding pass.
// The body carries only the plan id — the plan itself is re-read server-side
// from the recommendations row, so nothing user-authored reaches the sender.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));

  const to = String(body.email ?? "").trim();
  const planId = String(body.planId ?? "").trim();

  if (!planId) {
    return NextResponse.json({ error: "which plan? missing plan id." }, { status: 400 });
  }
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "that doesn't look like an email address." }, { status: 400 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "email isn't set up on this server yet — ask the operator to add RESEND_API_KEY." },
      { status: 503 }
    );
  }

  const result = await emailPackingPlan({
    userId: user.id,
    planId,
    to,
    passengerName: user.display_name || user.name || "traveller",
  });

  if (result.notFound) {
    return NextResponse.json({ error: "couldn't find that packing plan." }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "couldn't send that — try again?" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sentTo: to });
}
