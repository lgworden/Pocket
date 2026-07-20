"use client";

import { useState } from "react";

export default function InviteLinkCard({ inviteUrl }: { inviteUrl: string }) {
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
      <p className="text-sm font-medium mb-3">Share this link with friends!</p>
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
