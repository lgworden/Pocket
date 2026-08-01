import Link from "next/link";
import { getSessionUserId } from "@/lib/auth";
import { acceptInvite, getInviteInfo } from "@/lib/friends";
import { track } from "@/lib/analytics";
import AvatarUpload from "@/components/AvatarUpload";

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
  // Fetched pre-auth so the landing page can show who invited you before
  // asking for sign-in — a bare code-acceptance screen converts worse than
  // arriving somewhere that feels like it belongs to a real person.
  const info = await getInviteInfo(params.code);

  if (!info) {
    return (
      <Shell>
        <h1 className="text-3xl mt-2">Invite not found</h1>
        <p className="text-sm text-ink/60 mt-3 max-w-xs">
          This invite link is invalid or has been removed.
        </p>
        <Continue href="/" label="Go to your feed" />
      </Shell>
    );
  }

  const userId = await getSessionUserId();

  if (!userId) {
    return (
      <Shell>
        <InviterPreview name={info.inviterName} avatar={info.inviterAvatar} />
        <h1 className="text-3xl mt-4">You&apos;re invited</h1>
        <p className="text-sm text-ink/60 mt-3 max-w-xs">
          {info.inviterName} invited you to Pocket. Sign in to accept and start
          sharing fits.
        </p>
        {/* Both paths carry the code through, so the callback lands back here
            to finish accepting once the account exists. */}
        <Link
          href={`/login?invite=${encodeURIComponent(params.code)}`}
          className="btn-primary mt-8 w-full max-w-xs inline-flex items-center justify-center"
        >
          Create an account
        </Link>
        <a
          href={`/api/auth/google?invite=${encodeURIComponent(params.code)}`}
          className="btn-secondary mt-3 w-full max-w-xs inline-flex items-center justify-center"
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

  if (result.status === "self") {
    return (
      <Shell>
        <h1 className="text-3xl mt-2">That&apos;s your link</h1>
        <p className="text-sm text-ink/60 mt-3 max-w-xs">
          This is your own invite link — share it with a friend to connect.
        </p>
        <Continue href="/" label="Back to your feed" />
      </Shell>
    );
  }

  // Only reachable if the invite is deleted in the moment between the
  // getInviteInfo check above and this acceptInvite call.
  if (result.status === "invalid") {
    return (
      <Shell>
        <h1 className="text-3xl mt-2">Invite not found</h1>
        <p className="text-sm text-ink/60 mt-3 max-w-xs">
          This invite link is invalid or has been removed.
        </p>
        <Continue href="/" label="Go to your feed" />
      </Shell>
    );
  }

  return (
    <Shell>
      <InviterPreview name={result.inviterName} avatar={info.inviterAvatar} />
      <h1 className="text-3xl mt-4">
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

function InviterPreview({ name, avatar }: { name: string; avatar: string | null }) {
  return <AvatarUpload avatar={avatar} name={name} editable={false} />;
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
