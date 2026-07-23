"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { compressImage } from "@/lib/compressImage";
import { cropImage, type BoundingBox } from "@/lib/cropImage";
import { celebrate } from "@/lib/confetti";
import { CATEGORIES, OCCASIONS } from "@/lib/itemOptions";

type OutfitDraftItem = {
  name: string;
  category: string;
  subcategory: string;
  colors: string[];
  warmth: number | null;
  formality: number | null;
  occasions: string[];
  thumbnail: string | null; // data URL — cropped piece, or the full outfit photo as fallback
  include: boolean;
};

type RawDraft = {
  name?: string;
  category?: string;
  subcategory?: string;
  colors?: string[];
  warmth?: number | null;
  formality?: number | null;
  occasions?: string[];
  bounding_box?: BoundingBox;
};

// "Log my items": one full-outfit photo -> Claude identifies each piece worn
// -> a reviewable, editable card per piece -> user picks which are genuinely
// new to their closet and saves them all in one go. Lets people index their
// closet organically from outfit photos instead of one item at a time.
export default function AddFromOutfitClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"capture" | "analyzing" | "review" | "saving" | "done">(
    searchParams.get("photo") ? "analyzing" : "capture"
  );
  const [items, setItems] = useState<OutfitDraftItem[]>([]);
  const [outfitPhotoUrl, setOutfitPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  async function analyze(blob: Blob) {
    setError(null);
    setStatus("analyzing");
    try {
      const payload = await compressImage(blob);
      const dataUrl = `data:${payload.mediaType};base64,${payload.base64}`;

      const res = await fetch("/api/items/draft-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: payload.base64, mediaType: payload.mediaType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Couldn't read that photo — try again?");
      }
      const { items: rawItems, photoUrl } = (await res.json()) as {
        items: RawDraft[];
        photoUrl: string;
      };
      setOutfitPhotoUrl(photoUrl);

      const built = await Promise.all(
        (rawItems ?? []).slice(0, 8).map(async (raw) => {
          let thumbnail: string | null = dataUrl;
          if (raw.bounding_box) {
            try {
              const cropped = await cropImage(dataUrl, raw.bounding_box);
              thumbnail = `data:${cropped.mediaType};base64,${cropped.base64}`;
            } catch {
              // fall back to the full outfit photo below
            }
          }
          const item: OutfitDraftItem = {
            name: raw.name || "Unnamed piece",
            category: CATEGORIES.includes(raw.category ?? "") ? (raw.category as string) : "top",
            subcategory: raw.subcategory ?? "",
            colors: raw.colors ?? [],
            warmth: raw.warmth ?? null,
            formality: raw.formality ?? null,
            occasions: raw.occasions ?? [],
            thumbnail,
            include: true,
          };
          return item;
        })
      );

      if (built.length === 0) {
        throw new Error("Couldn't spot any pieces in that photo — try a clearer shot?");
      }

      setItems(built);
      setStatus("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("capture");
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await analyze(file);
  }

  // "Scan items" from an already-logged fit (components/closet/FitDetailModal.tsx)
  // links here with ?photo=<existing fit photo URL> — skip straight to analysis
  // instead of asking the user to retake the same photo.
  useEffect(() => {
    const photo = searchParams.get("photo");
    if (!photo) return;
    setStatus("analyzing");
    fetch(photo)
      .then((res) => res.blob())
      .then((blob) => analyze(blob))
      .catch(() => {
        setError("Couldn't load that fit's photo — try photographing it fresh?");
        setStatus("capture");
      });
    // Only run once, off the initial `photo` param — not on every searchParams identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateItem<K extends keyof OutfitDraftItem>(index: number, key: K, value: OutfitDraftItem[K]) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [key]: value } : it)));
  }

  function toggleOccasion(index: number, occasion: string) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const active = it.occasions.includes(occasion);
        return {
          ...it,
          occasions: active ? it.occasions.filter((o) => o !== occasion) : [...it.occasions, occasion],
        };
      })
    );
  }

  function reset() {
    setStatus("capture");
    setItems([]);
    setOutfitPhotoUrl(null);
    setSavedCount(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function logMyItems() {
    const toSave = items.filter((it) => it.include);
    if (toSave.length === 0) {
      setError("Nothing selected — toggle on at least one piece, or skip for now.");
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      let count = 0;
      for (const it of toSave) {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: it.name,
            category: it.category,
            subcategory: it.subcategory || null,
            colors: it.colors,
            warmth: it.warmth,
            formality: it.formality,
            occasions: it.occasions,
            photoBase64: it.thumbnail ? it.thumbnail.split(",")[1] : undefined,
            photoMediaType: it.thumbnail ? "image/jpeg" : undefined,
            photos: !it.thumbnail && outfitPhotoUrl ? [outfitPhotoUrl] : [],
          }),
        });
        if (res.ok) count += 1;
      }
      setSavedCount(count);
      celebrate();
      setStatus("done");
    } catch {
      setError("Something went wrong saving those — try again?");
      setStatus("review");
    }
  }

  return (
    <main className="px-4 pt-6 space-y-4 pb-28">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-ui font-semibold text-slate tracking-wide">Add item</p>
          <h1 className="text-2xl mt-1">Log my items</h1>
        </div>
        <button onClick={() => router.push("/closet")} className="text-sm text-slate">
          Done →
        </button>
      </header>

      {error && <div className="card bg-rose/10 border-rose/30 text-sm text-rose">{error}</div>}

      {status === "capture" && (
        <div className="card text-center space-y-3">
          <p className="text-sm text-ink/60">
            One photo of a whole outfit — we'll spot each piece and let you add the ones that are
            new to your closet.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            id="outfit-photo-input"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary w-full"
          >
            📷 Photograph the outfit
          </button>
        </div>
      )}

      {status === "analyzing" && (
        <div className="card text-center text-sm text-ink/60">Spotting each piece...</div>
      )}

      {(status === "review" || status === "saving") && (
        <div className="space-y-4">
          <p className="text-xs text-slate/60 px-1">
            Found {items.length} piece{items.length === 1 ? "" : "s"}. Toggle off anything you
            already logged or don't want to add.
          </p>

          {items.map((item, i) => (
            <div
              key={i}
              className={`card space-y-3 transition-opacity ${item.include ? "" : "opacity-50"}`}
            >
              <div className="flex gap-3">
                <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-blue/10">
                  {item.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <input
                    className="w-full bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                    value={item.name}
                    onChange={(e) => updateItem(i, "name", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => updateItem(i, "include", !item.include)}
                    className={`mt-2 tag self-start ${item.include ? "tag-blue" : "tag-outline"}`}
                  >
                    {item.include ? "✓ will log this" : "skipped"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-ui font-semibold text-slate tracking-wide">
                    Category
                  </label>
                  <select
                    className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                    value={item.category}
                    onChange={(e) => updateItem(i, "category", e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-ui font-semibold text-slate tracking-wide">
                    Colors
                  </label>
                  <input
                    className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                    value={item.colors.join(", ")}
                    onChange={(e) =>
                      updateItem(
                        i,
                        "colors",
                        e.target.value.split(",").map((c) => c.trim()).filter(Boolean)
                      )
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-ui font-semibold text-slate tracking-wide">
                  Occasions
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {OCCASIONS.map((o) => {
                    const active = item.occasions.includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        className={`tag ${active ? "tag-blue" : "tag-outline"}`}
                        onClick={() => toggleOccasion(i, o)}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          <button
            className="btn-primary w-full"
            onClick={logMyItems}
            disabled={status === "saving"}
          >
            {status === "saving" ? "logging..." : "log my items ✓"}
          </button>
          <button className="btn-secondary w-full" onClick={reset} disabled={status === "saving"}>
            Start over
          </button>
        </div>
      )}

      {status === "done" && (
        <div className="card text-center space-y-3">
          <p className="text-sm text-ink">
            ✓ Logged {savedCount} piece{savedCount === 1 ? "" : "s"} to your closet.
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={reset}>
              Log another outfit
            </button>
            <button className="btn-primary flex-1" onClick={() => router.push("/closet")}>
              Go to closet
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
