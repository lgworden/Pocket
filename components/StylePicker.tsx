"use client";

import { STYLE_OPTIONS } from "@/lib/onboardingOptions";

export default function StylePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const toggle = (style: string) => {
    onChange(value.includes(style) ? value.filter((s) => s !== style) : [...value, style]);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {STYLE_OPTIONS.map((style) => (
        <button
          key={style}
          type="button"
          onClick={() => toggle(style)}
          className={`p-2 text-sm rounded-full border transition-colors ${
            value.includes(style)
              ? "border-ink bg-ink text-cream font-medium"
              : "border-slate/20 bg-transparent text-slate hover:border-slate/40"
          }`}
        >
          {style}
        </button>
      ))}
    </div>
  );
}
