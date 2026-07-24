export const dynamic = "force-dynamic";

// Reachable while logged out — must NOT call getCurrentUser/requireOnboarded.
// Also linked from the Google OAuth consent screen configuration.
export default function PrivacyPage() {
  return (
    <main className="normal-case max-w-xl mx-auto px-6 py-10 text-sm leading-relaxed space-y-6">
      <div>
        <p className="text-xs font-ui font-semibold text-slate tracking-wide">Pocket</p>
        <h1 className="normal-case text-2xl mt-1">Privacy Policy</h1>
        <p className="text-xs text-slate mt-1">Last updated July 23, 2026</p>
      </div>

      <section className="space-y-2">
        <h2 className="normal-case font-semibold">What we collect</h2>
        <p>
          When you sign in with Google, we receive your name and email address. As you use
          Pocket, we store what you add yourself: closet items and their photos, outfit logs,
          and basic usage activity (like which features you use) so we can understand how the
          app is used and improve it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="normal-case font-semibold">Optional Google Calendar access</h2>
        <p>
          If you choose to connect Google Calendar, we read (read-only) your event times and
          titles to help time outfit suggestions to your day. We never write to or modify your
          calendar, and you can disconnect it at any time.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="normal-case font-semibold">How we use it</h2>
        <p>
          Your data is used to generate outfit recommendations and to share outfits with
          friends you choose to invite or connect with. We don&apos;t sell your data. We share
          it only with the service providers needed to run the app — for example, Anthropic&apos;s
          API to generate recommendations, and our hosting provider.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="normal-case font-semibold">Deletion &amp; contact</h2>
        <p>
          To request that your account and data be deleted, or if you have any questions, email{" "}
          <a href="mailto:lilygworden@gmail.com" className="underline">
            lilygworden@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
