"use client";

import { useState } from "react";
import Modal from "./Modal";
import NotificationPicker from "./NotificationPicker";
import { NOTIFY_KEYS, DEFAULT_DAILY_DIGEST_TIME } from "@/lib/onboardingOptions";

interface User {
  notification_preferences?: Record<string, any>;
}

export default function NotificationsModal({
  user,
  open,
  onClose,
}: {
  user: User;
  open: boolean;
  onClose: () => void;
}) {
  const [notify, setNotify] = useState<string[]>(
    NOTIFY_KEYS.filter((k) => user.notification_preferences?.[k])
  );
  const [digestTime, setDigestTime] = useState<string>(
    user.notification_preferences?.daily_digest_time || DEFAULT_DAILY_DIGEST_TIME
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_preferences: {
            ...Object.fromEntries(NOTIFY_KEYS.map((k) => [k, notify.includes(k)])),
            daily_digest_time: digestTime,
          },
        }),
      });
      if (!res.ok) throw new Error("Couldn't save — try again?");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Notifications">
      <div className="space-y-4">
        <p className="text-xs text-slate/60">
          Pick what lands in your notifications. (select all that apply)
        </p>
        <NotificationPicker value={notify} onChange={setNotify} />

        {notify.includes("daily_digest") && (
          <div>
            <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
              Daily digest time
            </label>
            <input
              type="time"
              className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
              value={digestTime}
              onChange={(e) => setDigestTime(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div className="bg-rose/10 border border-rose/30 rounded-lg p-3 text-sm text-rose">
            {error}
          </div>
        )}

        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? "saving..." : "save"}
        </button>
      </div>
    </Modal>
  );
}
