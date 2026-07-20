import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import OnboardingInteractive from "@/components/OnboardingInteractive";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user.onboarding_completed) {
    redirect("/");
  }

  return (
    <main className="px-4 pt-6 pb-24 space-y-6">
      <header>
        <p className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
          Welcome
        </p>
        <h1 className="text-2xl mt-1">It's so great to meet you!</h1>
      </header>

      <OnboardingInteractive user={user} />
    </main>
  );
}
