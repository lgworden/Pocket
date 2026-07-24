import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import WelcomeCarousel from "@/components/WelcomeCarousel";

export const dynamic = "force-dynamic";

// Shown once, right after onboarding and before the first real screen. Must
// not call requireOnboarded() — that would redirect right back here.
export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user.onboarding_completed) {
    redirect("/onboarding");
  }
  if (user.walkthrough_completed) {
    redirect("/");
  }

  return <WelcomeCarousel />;
}
