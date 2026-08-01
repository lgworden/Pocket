"use client";

import { useState } from "react";

export default function InviteLinkCard({
  inviteUrl,
  joinedCount,
}: {
  inviteUrl: string;
  joinedCount: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">Share this link with friends!</p>
        {joinedCount > 0 && (
          <span className="text-xs font-ui font-semibold rounded-full px-2 py-0.5 shrink-0 bg-ink/10 text-ink/70">
            {joinedCount} joined
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 rounded-full border border-slate/25 bg-cream px-4 py-2 text-sm text-ink/80"
        />
        <button className="btn-primary shrink-0" onClick={copyLink}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
