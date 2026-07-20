"use client";

import { HELP_OPTIONS } from "@/lib/onboardingOptions";

export default function GoalsPicker({
  value,
  onChange,
  otherOn,
  onOtherOnChange,
  otherText,
  onOtherTextChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  otherOn: boolean;
  onOtherOnChange: (on: boolean) => void;
  otherText: string;
  onOtherTextChange: (text: string) => void;
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((g) => g !== v) : [...value, v]);
  };

  return (
    <div className="space-y-2">
      {HELP_OPTIONS.map((opt) => (
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
        onClick={() => onOtherOnChange(!otherOn)}
        className={`w-full p-2.5 text-sm rounded-lg border text-left transition-colors ${
          otherOn
            ? "border-ink bg-ink text-cream font-medium"
            : "border-slate/20 bg-transparent text-slate hover:border-slate/40"
        }`}
      >
        Other
      </button>
      {otherOn && (
        <input
          type="text"
          className="w-full bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
          placeholder="Tell us more..."
          value={otherText}
          onChange={(e) => onOtherTextChange(e.target.value)}
        />
      )}
    </div>
  );
}
