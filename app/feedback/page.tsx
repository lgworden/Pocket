import { Suspense } from "react";
import { requireOnboarded } from "@/lib/auth";
import { listUserFeedback } from "@/lib/feedback";
import FeedbackForm from "@/components/FeedbackForm";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const user = await requireOnboarded();
  const recent = await listUserFeedback(user.id);

  return (
    <main className="px-4 pt-6 pb-24 space-y-6">
      <header>
        <p className="text-xs font-ui font-semibold text-slate tracking-wide">Say hi</p>
        <h1 className="text-2xl mt-1">Feedback</h1>
        <p className="text-sm text-ink/70 mt-2">
          pckt is built by one person, and this box goes straight to their inbox.
        </p>
      </header>

      {/* useSearchParams inside the form needs a boundary even on a dynamic page. */}
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <FeedbackForm recentCount={recent.length} />
      </Suspense>

      <BottomNav />
    </main>
  );
}
