"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FILTER_PRESETS,
  DEFAULT_PRESET_ID,
  GRAIN_OPACITY,
  getNoiseDataUrl,
  dateStampText,
  bakeFilter,
  type FilterPreset,
} from "@/lib/photoFilters";

// Photo-editing step for a feed post. Sits between picking a photo and sharing:
// opens on the unfiltered photo, then optionally pick a one-tap filter (the grainy
// "digicam" look is the second option), dial the Mood intensity, and burn in a
// camcorder date stamp. Preview is live via CSS; on "Use photo" the exact look is
// flattened onto a canvas so what you see uploads.
export default function PhotoEditor({
  src,
  onCancel,
  onDone,
}: {
  src: string; // data URL of the source photo
  onCancel: () => void;
  onDone: (result: { base64: string; mediaType: string; previewUrl: string }) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const preset = useMemo<FilterPreset>(
    () => FILTER_PRESETS.find((p) => p.id === presetId) ?? FILTER_PRESETS[0],
    [presetId]
  );
  // "Mood" is a 0–1 intensity for the whole filter effect; 1 = the preset as designed.
  const [mood, setMood] = useState(1);
  const [dateStamp, setDateStamp] = useState(preset.dateStamp);
  // Original has no grain/vignette/tint to dial — nothing for the Mood slider to do.
  const hasMood = preset.grain > 0 || preset.vignette > 0 || preset.tintAlpha > 0;
  const noiseUrl = useMemo(() => getNoiseDataUrl(), []);
  const stamp = useMemo(() => dateStampText(), []);

  // Preload the source into an off-DOM <img> we can hand straight to the canvas baker.
  useEffect(() => {
    const im = new Image();
    im.onload = () => {
      imgRef.current = im;
      setLoaded(true);
    };
    im.src = src;
  }, [src]);

  // Switching presets resets Mood to full + date-stamp to that look's default.
  function choosePreset(p: FilterPreset) {
    setPresetId(p.id);
    setMood(1);
    setDateStamp(p.dateStamp);
  }

  function apply() {
    if (!imgRef.current) return;
    const baked = bakeFilter(imgRef.current, { preset, mood, dateStamp });
    onDone({
      ...baked,
      previewUrl: `data:${baked.mediaType};base64,${baked.base64}`,
    });
  }

  const cssFilter = preset.css === "none" ? "none" : preset.css;
  // Grain/vignette/tint scaled by the Mood slider (the color grade stays at full).
  const effGrain = preset.grain * mood;
  const effVignette = preset.vignette * mood;
  const effTintAlpha = preset.tintAlpha * mood;

  return (
    <div className="space-y-4">
      {/* Live preview */}
      <div className="relative overflow-hidden rounded-xl bg-ink/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="editing preview"
          className="w-full block object-cover"
          style={{ filter: cssFilter }}
        />
        {/* Grain overlay */}
        {effGrain > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url(${noiseUrl})`,
              backgroundSize: "128px 128px",
              mixBlendMode: "overlay",
              opacity: effGrain * GRAIN_OPACITY,
            }}
          />
        )}
        {/* Color cast */}
        {preset.tint && effTintAlpha > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `rgb(${preset.tint})`,
              mixBlendMode: "soft-light",
              opacity: effTintAlpha,
            }}
          />
        )}
        {/* Vignette */}
        {effVignette > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${effVignette}) 100%)`,
            }}
          />
        )}
        {/* Date stamp */}
        {dateStamp && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 right-3 font-mono tracking-wide"
            style={{
              color: "#ffb200",
              fontSize: "clamp(11px, 3.2vw, 16px)",
              textShadow: "0 0 6px rgba(255,120,0,0.9)",
            }}
          >
            {stamp}
          </span>
        )}
      </div>

      {/* Filter strip */}
      <div>
        <label className="text-xs font-ui font-semibold text-slate tracking-wide">
          Filter
        </label>
        <div className="mt-2 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTER_PRESETS.map((p) => {
            const active = p.id === presetId;
            const thumbFilter = p.css === "none" ? "none" : p.css;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => choosePreset(p)}
                className="flex-shrink-0 text-center focus:outline-none"
              >
                <div
                  className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors ${
                    active ? "border-brown" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    style={{ filter: thumbFilter }}
                  />
                  {p.grain > 0 && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        backgroundImage: `url(${noiseUrl})`,
                        backgroundSize: "64px 64px",
                        mixBlendMode: "overlay",
                        opacity: p.grain * GRAIN_OPACITY,
                      }}
                    />
                  )}
                </div>
                <span
                  className={`mt-1 block text-[11px] ${
                    active ? "font-semibold text-ink" : "text-slate"
                  }`}
                >
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mood slider — scales the filter's grain + vignette + tint together.
          Hidden for Original: there's no effect intensity to dial. */}
      {hasMood && (
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-ui font-semibold text-slate tracking-wide">
              Mood
            </label>
            <span className="text-xs text-slate/70">{Math.round(mood * 100)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(mood * 100)}
            onChange={(e) => setMood(Number(e.target.value) / 100)}
            className="mt-1 w-full accent-brown"
            aria-label="Mood intensity"
          />
        </div>
      )}

      {/* Date stamp toggle */}
      <button
        type="button"
        onClick={() => setDateStamp((v) => !v)}
        aria-pressed={dateStamp}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors ${
          dateStamp ? "border-brown bg-brown/10" : "border-slate/20"
        }`}
      >
        <span className="font-medium text-ink">Date stamp</span>
        <span
          className={`font-mono text-xs ${dateStamp ? "text-brown" : "text-slate/50"}`}
          style={dateStamp ? { textShadow: "0 0 5px rgba(255,120,0,0.5)" } : undefined}
        >
          {stamp}
        </span>
      </button>

      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary flex-1 disabled:opacity-50"
          onClick={apply}
          disabled={!loaded}
        >
          Use photo
        </button>
      </div>
    </div>
  );
}
