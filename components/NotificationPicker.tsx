"use client";

import { NOTIFY_OPTIONS, NOTIFY_KEYS } from "@/lib/onboardingOptions";

export default function NotificationPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const allOn = NOTIFY_KEYS.every((k) => value.includes(k));

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((n) => n !== v) : [...value, v]);
  };

  // "Whatever the chef recommends" — all on, or clear if already all on.
  const toggleChef = () => onChange(allOn ? [] : [...NOTIFY_KEYS]);

  return (
    <div className="space-y-2">
      {NOTIFY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`w-full p-2.5 text-sm rounded-lg border text-left transition-colors ${
            value.includes(opt.value)
              ? "border-ink bg-ink text-cream font-medium"
              : "border-slate/20 bg-transparent text-slate hover:border-slate/40"
          }`}
        >
          {opt.label}
        </button>
      ))}
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
