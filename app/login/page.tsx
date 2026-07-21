import { getSessionUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Reachable while logged out — must NOT call getCurrentUser/requireOnboarded.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const existing = await getSessionUserId();
  if (existing) redirect("/");

  const error = searchParams.error;
  const showDevLogin = process.env.NODE_ENV !== "production";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-ui font-semibold text-slate tracking-wide">
        Welcome to
      </p>
      <h1 className="text-3xl mt-2">Pocket</h1>
      <p className="text-sm text-ink/60 mt-3 max-w-xs">
        Snap your fit. Plan tomorrow's. Repeat.
      </p>

      {error && (
        <div className="card bg-rose/10 border-rose/30 text-sm text-rose mt-6 w-full max-w-xs">
          {error === "denied"
            ? "Sign-in was cancelled. Try again?"
            : "Something went wrong signing in. Try again?"}
        </div>
      )}

      <a
        href="/api/auth/google"
        className="btn-primary mt-8 w-full max-w-xs inline-flex items-center justify-center gap-2"
      >
        Continue with Google
      </a>

      {showDevLogin && (
        <a
          href="/api/auth/dev-login"
          className="mt-4 text-xs font-ui text-ink/40 underline"
        >
          Dev login (seed user)
        </a>
      )}
    </main>
  );
}
