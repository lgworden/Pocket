"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { compressImage } from "@/lib/compressImage";
import { celebrate } from "@/lib/confetti";

type PickerItem = {
  id: string;
  display_id: string;
  name: string;
  category: string;
  photos: string[];
};

const CATEGORY_LABELS: Record<string, string> = {
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses",
  outerwear: "Outerwear",
  shoes: "Shoes",
  bag: "Bags",
  accessory: "Accessories",
};

export type LoggedFit = {
  id: string;
  photo: string;
  created_at: string;
  notes: string | null;
  tagged_items: { id: string; display_id: string; name: string }[];
  shared_to_feed: boolean;
};

// Compose flow for a "recent fit" pic: photo → tag which closet items you're
// wearing (optional, multi-select, grouped by category) → optional notes →
// save. Tagging writes to outfit_logs so wear stats update automatically.
export default function LogFitComposer({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (fit: LoggedFit) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<"compose" | "tagging">("compose");
  const [preview, setPreview] = useState<string | null>(null);
  const [payload, setPayload] = useState<{ base64: string; mediaType: string } | null>(null);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/items")
      .then((res) => res.json())
      .then((data: PickerItem[]) => setItems(data))
      .catch(() => setItems([]));
  }, [open]);

  function reset() {
    setView("compose");
    setPreview(null);
    setPayload(null);
    setSelected(new Set());
    setNotes("");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    reset();
    onClose();
  }

  function handleModalClose() {
    if (view === "tagging") {
      setView("compose");
    } else {
      close();
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImage(file);
      setPayload(compressed);
      setPreview(`data:${compressed.mediaType};base64,${compressed.base64}`);
    } catch {
      setError("Couldn't read that photo — try another?");
    }
  }

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!payload) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/outfit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: payload.base64,
          mediaType: payload.mediaType,
          itemIds: Array.from(selected),
          notes,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      celebrate();
      onSaved({
        id: data.id,
        photo: data.photo,
        created_at: data.created_at,
        notes: notes.trim() || null,
        tagged_items: items
          .filter((i) => selected.has(i.id))
          .map((i) => ({ id: i.id, display_id: i.display_id, name: i.name })),
        shared_to_feed: false,
      });
      reset();
    } catch {
      setError("Couldn't save that fit — try again?");
    } finally {
      setSaving(false);
    }
  }

  const byCategory = items.reduce<Record<string, PickerItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const selectedItems = items.filter((i) => selected.has(i.id));

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      title={view === "tagging" ? "Tag items" : "Log a fit"}
    >
      {view === "tagging" ? (
        <div className="space-y-4">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {Object.keys(byCategory).length === 0 && (
              <p className="text-xs text-slate/60">No closet items yet.</p>
            )}
            {Object.entries(byCategory).map(([category, catItems]) => (
              <div key={category}>
                <p className="text-[11px] font-ui font-semibold text-slate/70 tracking-wide mb-1.5">
                  {CATEGORY_LABELS[category] ?? category}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {catItems.map((item) => {
                    const active = selected.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="text-left"
                      >
                        <div
                          className={`relative aspect-square rounded-lg overflow-hidden bg-blue/10 border transition-colors ${
                            active ? "border-ink border-2" : "border-slate/15"
                          }`}
                        >
                          {item.photos[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.photos[0]}
                              alt={item.name}
                              className={`w-full h-full object-cover transition-opacity ${
                                active ? "opacity-70" : ""
                              }`}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-center text-[10px] text-slate/50 px-1">
                              {item.name}
                            </div>
                          )}
                          {active && (
                            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-ink text-cream flex items-center justify-center text-[10px] leading-none">
                              ✓
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => setView("compose")}
          >
            Done{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Photo */}
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="fit preview" className="w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setPayload(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute top-2 right-2 bg-ink/70 text-cream rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="aspect-square bg-blue/10 rounded-xl border border-dashed border-slate/40 flex flex-col items-center justify-center gap-2 cursor-pointer text-slate">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFile}
              />
              <span className="text-3xl leading-none">＋</span>
              <span className="text-sm">Add a photo</span>
            </label>
          )}

          {/* Item tagging */}
          <div>
            <label className="text-xs font-ui font-semibold text-slate tracking-wide">
              What are you wearing? (optional)
            </label>

            {selectedItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedItems.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => toggleItem(i.id)}
                    className="tag bg-ink text-cream flex items-center gap-1"
                  >
                    {i.display_id}
                    <span className="opacity-60">×</span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setView("tagging")}
              className="btn-secondary w-full mt-2"
            >
              {selectedItems.length > 0 ? "Edit tagged items" : "Tag items"}
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-ui font-semibold text-slate tracking-wide">
              Notes (optional)
            </label>
            <textarea
              className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm resize-none"
              rows={2}
              placeholder="how'd it feel?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-rose/10 border border-rose/30 rounded-lg p-3 text-sm text-rose">
              {error}
            </div>
          )}

          <button
            className="btn-primary w-full disabled:opacity-50"
            onClick={save}
            disabled={!payload || saving}
          >
            {saving ? "Saving..." : "Save fit"}
          </button>
        </div>
      )}
    </Modal>
  );
}
