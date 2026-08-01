import { getSessionUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";

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
  const invite = typeof searchParams.invite === "string" ? searchParams.invite : undefined;
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

      <AuthForm invite={invite} />

      <div className="w-full max-w-xs flex items-center gap-3 mt-6 mb-4">
        <span className="flex-1 h-px bg-slate/20" />
        <span className="text-[11px] font-ui text-ink/40">or</span>
        <span className="flex-1 h-px bg-slate/20" />
      </div>

      <a
        href={invite ? `/api/auth/google?invite=${encodeURIComponent(invite)}` : "/api/auth/google"}
        className="btn-secondary w-full max-w-xs inline-flex items-center justify-center gap-2"
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
