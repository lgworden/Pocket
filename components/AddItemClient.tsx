"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { compressImage } from "@/lib/compressImage";
import { celebrate } from "@/lib/confetti";

const CATEGORIES = ["top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory"];
const OCCASIONS = ["workwear", "casual", "going-out", "athletic", "lounge"];
const PROVENANCES = ["thrifted", "retail", "gifted", "secondhand", "handmade"];

type Draft = {
  name: string;
  category: string;
  subcategory: string;
  colors: string[];
  warmth: number | null;
  formality: number | null;
  occasions: string[];
};

export default function AddItemClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"capture" | "drafting" | "confirm" | "saving">("capture");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [imagePayload, setImagePayload] = useState<{ base64: string; mediaType: string } | null>(
    null
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [provenance, setProvenance] = useState("");
  const [cost, setCost] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLastSaved(null);
    setStatus("drafting");
    try {
      const payload = await compressImage(file);
      setImagePayload(payload);
      const res = await fetch("/api/items/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: payload.base64, mediaType: payload.mediaType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Couldn't read that photo — try again?");
      }
      const { draft, photoUrl } = await res.json();
      setDraft(draft);
      setPhotoUrl(photoUrl);
      setStatus("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("capture");
    }
  }

  async function handleSave() {
    if (!draft) return;
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          tags: tags
            ? tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [],
          provenance: provenance || null,
          cost: cost ? Number(cost) : null,
          photos: photoUrl ? [photoUrl] : [],
        }),
      });
      if (!res.ok) throw new Error("Couldn't save that item — try again?");
      const saved = await res.json();
      setLastSaved(saved.display_id);
      celebrate();
      // Reset for rapid successive adds (catalog 30 items in one sitting).
      setStatus("capture");
      setDraft(null);
      setPhotoUrl(null);
      setImagePayload(null);
      setProvenance("");
      setCost("");
      setTags("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("confirm");
    }
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  return (
    <main className="px-4 pt-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
            Add item
          </p>
          <h1 className="text-2xl mt-1">Snap a piece</h1>
        </div>
        <button onClick={() => router.push("/closet")} className="text-sm text-slate">
          Done →
        </button>
      </header>

      {lastSaved && (
        <div className="card bg-blue/10 border-blue/30 text-sm">
          ✓ Saved as {lastSaved}. Next item?
        </div>
      )}
      {error && (
        <div className="card bg-rose/10 border-rose/30 text-sm text-rose">{error}</div>
      )}

      {status === "capture" && (
        <div className="card text-center space-y-3">
          <p className="text-sm text-ink/60">
            Photograph one item at a time, flat or on a hanger, good light.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            id="photo-input"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary w-full"
          >
            📷 Add photo
          </button>
        </div>
      )}

      {status === "drafting" && (
        <div className="card text-center text-sm text-ink/60">
          Studying your piece...
        </div>
      )}

      {(status === "confirm" || status === "saving") && draft && (
        <div className="space-y-4">
          <div className="polaroid">
            <div className="aspect-square bg-blue/10 rounded-xl overflow-hidden">
              {photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="item" className="w-full h-full object-cover" />
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setStatus("capture");
              setPhotoUrl(null);
              setImagePayload(null);
              setDraft(null);
            }}
            className="btn-secondary w-full"
          >
            Retake photo
          </button>

          <div className="card space-y-3">
            <div>
              <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                Name
              </label>
              <input
                className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                value={draft.name}
                onChange={(e) => updateDraft("name", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                  Category
                </label>
                <select
                  className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                  value={draft.category}
                  onChange={(e) => updateDraft("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                  Subcategory
                </label>
                <input
                  className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                  value={draft.subcategory}
                  onChange={(e) => updateDraft("subcategory", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                Colors (comma separated)
              </label>
              <input
                className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                value={draft.colors.join(", ")}
                onChange={(e) =>
                  updateDraft(
                    "colors",
                    e.target.value.split(",").map((c) => c.trim()).filter(Boolean)
                  )
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                  Warmth (1-5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                  value={draft.warmth ?? ""}
                  onChange={(e) => updateDraft("warmth", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div>
                <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                  Formality (1-5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                  value={draft.formality ?? ""}
                  onChange={(e) => updateDraft("formality", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                Occasions
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {OCCASIONS.map((o) => {
                  const active = draft.occasions.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      className={`tag ${active ? "tag-blue" : "tag-outline"}`}
                      onClick={() =>
                        updateDraft(
                          "occasions",
                          active
                            ? draft.occasions.filter((x) => x !== o)
                            : [...draft.occasions, o]
                        )
                      }
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                Provenance
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PROVENANCES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`tag ${provenance === p ? "tag-blue" : "tag-outline"}`}
                    onClick={() => setProvenance(provenance === p ? "" : p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                Cost (optional, skip it for now)
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                placeholder="$"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
                Tags (optional, comma separated)
              </label>
              <input
                className="w-full mt-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
                placeholder="the good jeans, structured"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          <button
            className="btn-primary w-full"
            disabled={status === "saving"}
            onClick={handleSave}
          >
            {status === "saving" ? "saving..." : "save to closet"}
          </button>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
