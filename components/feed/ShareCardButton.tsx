"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";

// Brand hex values, duplicated from tailwind.config.ts because <canvas>
// drawing can't reach Tailwind's theme — keep these in sync if the palette
// changes. See lib/feed.ts's VISIBILITY_STYLES for the same "one warm
// accent" system these are pulled from.
const CREAM = "#FBF8F3";
const INK = "#2E2924";
const CARAMEL = "#AD8A64";

const CARD_W = 720;
const CARD_H = 1280; // 9:16 — fits an Instagram Story without letterboxing

// Renders a downloadable/shareable branded image of one of the user's own
// posts — the acquisition channel for an invite-only app (see
// SOCIAL_PIVOT_PLAN.md Phase 3: "not a nice-to-have, the only channel").
// Scoped to the poster's own posts only; the caller (FeedCard) is
// responsible for only rendering this for post.is_mine.
export default function ShareCardButton({
  photo,
  caption,
  authorName,
}: {
  photo: string | null;
  caption: string | null;
  authorName: string;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    function drawTextBlock() {
      if (!ctx) return;
      const pad = 48;
      const bottom = CARD_H - pad;

      // Wordmark, always present — the whole point of the artifact.
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillStyle = CARAMEL;
      ctx.font = "700 34px Georgia, serif";
      ctx.fillText("pckt", pad, bottom);

      ctx.font = "400 22px Georgia, serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`${authorName}'s look`, pad, bottom - 46);

      if (caption) {
        ctx.font = "400 26px Georgia, serif";
        ctx.fillStyle = "#FFFFFF";
        wrapText(ctx, caption, pad, bottom - 90, CARD_W - pad * 2, 34);
      }
    }

    function finish() {
      if (!cancelled) setReady(true);
    }

    if (photo) {
      const img = new Image();
      img.onload = () => {
        if (cancelled || !ctx) return;
        // Cover-fit the photo into the full card.
        const scale = Math.max(CARD_W / img.width, CARD_H / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);

        // Bottom gradient so white text stays legible over any photo.
        const grad = ctx.createLinearGradient(0, CARD_H - 420, 0, CARD_H);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.65)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, CARD_H - 420, CARD_W, 420);

        drawTextBlock();
        finish();
      };
      img.onerror = () => {
        if (cancelled || !ctx) return;
        ctx.fillStyle = CREAM;
        ctx.fillRect(0, 0, CARD_W, CARD_H);
        ctx.fillStyle = INK;
        drawTextBlock();
        finish();
      };
      img.src = photo;
    } else {
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      // Text block above assumes a photo background (white text) — flip to
      // dark text on the plain cream fallback instead.
      ctx.fillStyle = INK;
      const pad = 48;
      const bottom = CARD_H - pad;
      ctx.textAlign = "left";
      ctx.fillStyle = CARAMEL;
      ctx.font = "700 34px Georgia, serif";
      ctx.fillText("pckt", pad, bottom);
      ctx.font = "400 22px Georgia, serif";
      ctx.fillStyle = INK;
      ctx.fillText(`${authorName}'s look`, pad, bottom - 46);
      if (caption) {
        ctx.font = "400 26px Georgia, serif";
        wrapText(ctx, caption, pad, bottom - 90, CARD_W - pad * 2, 34);
      }
      finish();
    }

    return () => {
      cancelled = true;
    };
  }, [open, photo, caption, authorName]);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pckt-look.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  async function shareNative() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "pckt-look.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "My look on pckt" });
        } catch {
          // User cancelled the share sheet — not an error.
        }
      } else {
        download();
      }
    }, "image/png");
  }

  const canNativeShare =
    typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share to Instagram or elsewhere"
        className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs bg-cream/70 text-ink border border-slate/15 hover:border-slate/40 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <path d="M16 6l-4-4-4 4" />
          <path d="M12 2v13" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Share your look">
        <div className="space-y-3">
          <div className="w-full max-w-[280px] mx-auto rounded-xl overflow-hidden shadow-soft-sm bg-panel aspect-[9/16]">
            <canvas
              ref={canvasRef}
              width={CARD_W}
              height={CARD_H}
              className="w-full h-full"
            />
          </div>
          <div className="flex gap-2">
            {canNativeShare && (
              <button
                type="button"
                onClick={shareNative}
                disabled={!ready}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Share
              </button>
            )}
            <button
              type="button"
              onClick={download}
              disabled={!ready}
              className={`flex-1 disabled:opacity-50 ${
                canNativeShare ? "btn-secondary" : "btn-primary"
              }`}
            >
              Download
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Simple greedy word-wrap for canvas text — canvas has no native wrapping.
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  bottomY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);

  const truncated = lines.length > maxLines || lines.join(" ").length < text.length;
  if (truncated && lines.length >= maxLines) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s*$/, "")}…`;
  }

  // Lines are drawn upward from bottomY so the block stays anchored to the
  // bottom of the card regardless of how many lines the caption needs.
  const startY = bottomY - (lines.length - 1) * lineHeight;
  lines.slice(0, maxLines).forEach((line, i) => {
    ctx.fillText(line, x, startY + i * lineHeight);
  });
}
