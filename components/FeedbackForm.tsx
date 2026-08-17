"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

const SENTIMENTS = [
  { value: "love", emoji: "😍", label: "loving it" },
  { value: "meh", emoji: "😐", label: "it's fine" },
  { value: "bug", emoji: "🐛", label: "something's broken" },
  { value: "idea", emoji: "💡", label: "i have an idea" },
] as const;

const MAX_LENGTH = 4000;

export default function FeedbackForm({ recentCount }: { recentCount: number }) {
  // `?from=weekly` is what the Monday notification deep-links with, so the
  // stored `source` tells you whether the nudge is actually working.
  const from = useSearchParams().get("from");

  const [sentiment, setSentiment] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          sentiment,
          source: from === "weekly" ? "weekly_reminder" : "app",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't send that — try again?");
      }
      setSent(true);
      setMessage("");
      setSentiment(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="card text-center space-y-3">
        <p className="text-3xl">💌</p>
        <p className="font-ui font-semibold text-ink">thank you, truly</p>
        <p className="text-sm text-ink/70">
          That went straight to the person building pckt. Every note gets read.
        </p>
        <button className="btn-secondary text-xs" onClick={() => setSent(false)}>
          send another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-ui font-semibold text-slate tracking-wide">
          How&apos;s pckt treating you? (optional)
        </label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {SENTIMENTS.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={sentiment === s.value}
              onClick={() => setSentiment(sentiment === s.value ? null : s.value)}
              className={`rounded-xl border p-3 text-left text-sm font-ui transition ${
                sentiment === s.value
                  ? "border-blue/50 bg-blue/10 text-ink"
                  : "border-slate/20 text-ink/70 hover:border-slate/40"
              }`}
            >
              <span className="mr-2">{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="feedback-message"
          className="text-xs font-ui font-semibold text-slate tracking-wide"
        >
          What&apos;s on your mind?
        </label>
        <textarea
          id="feedback-message"
          className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-3 text-sm min-h-[140px]"
          placeholder="Anything at all — what you love, what's annoying, what's missing."
          maxLength={MAX_LENGTH}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-xs text-slate/50 mt-1">
          {message.length}/{MAX_LENGTH}
        </p>
      </div>

      {error && (
        <div className="bg-rose/10 border border-rose/30 rounded-lg p-3 text-sm text-rose">
          {error}
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={send}
        disabled={sending || !message.trim()}
      >
        {sending ? "sending..." : "send feedback"}
      </button>

      {recentCount > 0 && (
        <p className="text-xs text-slate/50 text-center">
          You&apos;ve sent {recentCount} note{recentCount === 1 ? "" : "s"} so far. Keep them coming.
        </p>
      )}
    </div>
  );
}
