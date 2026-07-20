"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StylePicker from "./StylePicker";
import GoalsPicker from "./GoalsPicker";
import NotificationPicker from "./NotificationPicker";
import { NOTIFY_KEYS } from "@/lib/onboardingOptions";

interface User {
  id: string;
  name: string;
  display_name?: string;
  style_profile?: Record<string, any>;
  notification_preferences?: Record<string, any>;
}

export default function OnboardingInteractive({ user }: { user: User }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.display_name || user.name || "");
  const [styleTypes, setStyleTypes] = useState<string[]>(
    user.style_profile?.style_types || []
  );
  const [goals, setGoals] = useState<string[]>(user.style_profile?.goals || []);
  const [otherOn, setOtherOn] = useState(Boolean(user.style_profile?.goals_other));
  const [goalsOther, setGoalsOther] = useState(user.style_profile?.goals_other || "");
  const [notify, setNotify] = useState<string[]>(
    NOTIFY_KEYS.filter((k) => user.notification_preferences?.[k])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          style_profile: {
            style_types: styleTypes,
            goals,
            goals_other: otherOn ? goalsOther : "",
          },
          notification_preferences: Object.fromEntries(
            NOTIFY_KEYS.map((k) => [k, notify.includes(k)])
          ),
          onboarding_completed: true,
        }),
      });
      if (!res.ok) throw new Error("Couldn't save that — try again?");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="card">
        <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
          What should we call you?
        </label>
        <input
          type="text"
          className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      {/* Your Style */}
      <div className="card">
        <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
          What's your vibe?
        </label>
        <p className="text-xs text-slate/60 mt-1 mb-3">
          How would you describe your personal style? (select all that apply)
        </p>
        <StylePicker value={styleTypes} onChange={setStyleTypes} />
      </div>

      {/* How can we help */}
      <div className="card">
        <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
          How can we help?
        </label>
        <p className="text-xs text-slate/60 mt-1 mb-3">
          Select everything you're hoping to get out of this. (select all that apply)
        </p>
        <GoalsPicker
          value={goals}
          onChange={setGoals}
          otherOn={otherOn}
          onOtherOnChange={setOtherOn}
          otherText={goalsOther}
          onOtherTextChange={setGoalsOther}
        />
      </div>

      {/* How often do you want to hear from us */}
      <div className="card">
        <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
          How often do you want to hear from us?
        </label>
        <p className="text-xs text-slate/60 mt-1 mb-3">
          Pick what lands in your notifications. (select all that apply)
        </p>
        <NotificationPicker value={notify} onChange={setNotify} />
      </div>

      {error && (
        <div className="card bg-rose/10 border-rose/30 text-sm text-rose">{error}</div>
      )}

      <button className="btn-primary w-full" onClick={finish} disabled={saving}>
        {saving ? "Setting things up..." : "Get started"}
      </button>
    </div>
  );
}
