"use client";

import { NOTIFY_GROUPS, NOTIFY_KEYS } from "@/lib/onboardingOptions";

export default function NotificationPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const allOn = NOTIFY_KEYS.every((k) => value.includes(k));

  // Each group flips all of its underlying keys together; a group reads as
  // "on" only once every key in it is on.
  const toggleGroup = (keys: string[]) => {
    const groupOn = keys.every((k) => value.includes(k));
    onChange(
      groupOn
        ? value.filter((v) => !keys.includes(v))
        : [...value.filter((v) => !keys.includes(v)), ...keys]
    );
  };

  // "Whatever the chef recommends" — all on, or clear if already all on.
  const toggleChef = () => onChange(allOn ? [] : [...NOTIFY_KEYS]);

  return (
    <div className="space-y-2">
      {NOTIFY_GROUPS.map((group) => {
        const groupOn = group.keys.every((k) => value.includes(k));
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => toggleGroup(group.keys)}
            className={`w-full p-2.5 text-sm rounded-lg border text-left transition-colors ${
              groupOn
                ? "border-ink bg-ink text-cream font-medium"
                : "border-slate/20 bg-transparent text-slate hover:border-slate/40"
            }`}
          >
            {group.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={toggleChef}
        className={`w-full p-2.5 text-sm rounded-lg border text-left transition-colors ${
          allOn
            ? "border-ink bg-ink text-cream font-medium"
            : "border-slate/20 bg-transparent text-slate hover:border-slate/40"
        }`}
      >
        Whatever the chef recommends (all notif options)
      </button>
    </div>
  );
}
