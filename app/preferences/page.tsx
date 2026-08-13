import { requireOnboarded } from "@/lib/auth";
import { getInviteUsage, inviteUrlFor } from "@/lib/friends";
import PreferencesInteractive from "@/components/PreferencesInteractive";
import InviteLinkCard from "@/components/InviteLinkCard";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const user = await requireOnboarded();
  const invite = await getInviteUsage(user.id);

  return (
    <main className="px-4 pt-6 md:pt-24 space-y-6 pb-24">
      <header>
        <p className="text-xs font-ui font-semibold text-slate tracking-wide">
          Settings
        </p>
        <h1 className="text-2xl mt-1">Preferences</h1>
      </header>

      <PreferencesInteractive user={user} userId={user.id} />

      <InviteLinkCard
        inviteUrl={inviteUrlFor(invite.code)}
        joinedCount={invite.joinedCount}
      />

      <div className="pt-2 text-center">
        {/* Username accounts have no email — show the handle instead. */}
        <p className="text-xs text-ink/40 mb-2">
          Signed in as {user.username ? `@${user.username}` : user.email}
        </p>
        <a
          href="/api/auth/logout"
          className="text-sm font-ui font-semibold text-slate underline"
        >
          Sign out
        </a>
      </div>

      <BottomNav />
    </main>
  );
}
