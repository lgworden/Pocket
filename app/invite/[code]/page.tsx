import Link from "next/link";
import { getSessionUserId } from "@/lib/auth";
import { acceptInvite } from "@/lib/friends";
import { track } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// Reachable while logged out — must NOT call getCurrentUser/requireOnboarded.
// Logged in  → accept the invite and confirm.
// Logged out → prompt sign-in, carrying the code through OAuth so the callback
//              returns here to finish accepting.
export default async function InvitePage({
  params,
}: {
  params: { code: string };
}) {
  const userId = await getSessionUserId();

  if (!userId) {
    return (
      <Shell>
        <h1 className="text-3xl mt-2">You&apos;re invited</h1>
        <p className="text-sm text-ink/60 mt-3 max-w-xs">
          A friend invited you to Pocket. Sign in to accept and start
          sharing fits.
        </p>
        <a
          href={`/api/auth/google?invite=${encodeURIComponent(params.code)}`}
          className="btn-primary mt-8 w-full max-w-xs inline-flex items-center justify-center"
        >
          Continue with Google
        </a>
      </Shell>
    );
  }

  const result = await acceptInvite(params.code, userId);

  if (result.status === "accepted") {
    track(userId, "invite_accepted", { inviterName: result.inviterName });
  }

  if (result.status === "invalid") {
    return (
      <Shell>
        <h1 className="text-3xl mt-2">Invite not found</h1>
        <p className="text-sm text-ink/60 mt-3 max-w-xs">
          This invite link is invalid or has been removed.
        </p>
        <Continue href="/feed" label="Go to your feed" />
      </Shell>
    );
  }

  if (result.status === "self") {
    return (
      <Shell>
        <h1 className="text-3xl mt-2">That&apos;s your link</h1>
        <p className="text-sm text-ink/60 mt-3 max-w-xs">
          This is your own invite link — share it with a friend to connect.
        </p>
        <Continue href="/feed" label="Back to your feed" />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-3xl mt-2">
        {result.status === "already_friends"
          ? `You're already friends with ${result.inviterName}`
          : `You're now friends with ${result.inviterName}!`}
      </h1>
      <p className="text-sm text-ink/60 mt-3 max-w-xs">
        Their shared outfits will show up in your feed.
      </p>
      <Continue href="/" label="Continue" />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-ui font-semibold text-slate tracking-wide">
        Pocket
      </p>
      {children}
    </main>
  );
}

function Continue({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="btn-primary mt-8 w-full max-w-xs inline-flex items-center justify-center"
    >
      {label}
    </Link>
  );
}
