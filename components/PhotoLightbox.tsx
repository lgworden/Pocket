"use client";

import { useEffect, useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: PointerEvent, b: PointerEvent) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

// Fullscreen photo viewer with pinch-to-zoom (touch), wheel-zoom (trackpad/
// mouse), double-tap/double-click to zoom, and drag-to-pan once zoomed.
// Renders as `fixed inset-0` in place — callers must not mount it inside an
// ancestor with an active `transform` (FeedCard's flip container has one,
// but only while flipped; this is rendered as a sibling of it, not a
// descendant, so it stays anchored to the real viewport).
export default function PhotoLightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [gesturing, setGesturing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, PointerEvent>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setTx(0);
    setTy(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function clampPan(nextScale: number, nextTx: number, nextTy: number) {
    const img = imgRef.current;
    if (!img) return { tx: nextTx, ty: nextTy };
    const maxX = Math.max(0, (img.offsetWidth * nextScale - window.innerWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * nextScale - window.innerHeight) / 2);
    return { tx: clamp(nextTx, -maxX, maxX), ty: clamp(nextTy, -maxY, maxY) };
  }

  function zoomTo(nextScale: number) {
    const clamped = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const { tx: nx, ty: ny } = clampPan(clamped, tx, ty);
    setScale(clamped);
    setTx(nx);
    setTy(ny);
  }

  function toggleDoubleTapZoom() {
    if (scale > 1) {
      setScale(1);
      setTx(0);
      setTy(0);
    } else {
      zoomTo(DOUBLE_TAP_SCALE);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Pointer capture is best-effort — a stale/invalid pointer id (or a
      // browser that rejects capture for this pointer type) shouldn't stop
      // us from tracking the gesture.
    }
    pointers.current.set(e.pointerId, e.nativeEvent);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: distance(a, b), scale };
      panStart.current = null;
    } else if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
    }
    setGesturing(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.nativeEvent);

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const factor = distance(a, b) / pinchStart.current.distance;
      zoomTo(pinchStart.current.scale * factor);
    } else if (pointers.current.size === 1 && panStart.current && scale > 1) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const { tx: nx, ty: ny } = clampPan(scale, panStart.current.tx + dx, panStart.current.ty + dy);
      setTx(nx);
      setTy(ny);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const wasSingleTap =
      pointers.current.size === 1 &&
      panStart.current &&
      Math.abs(e.clientX - panStart.current.x) < 10 &&
      Math.abs(e.clientY - panStart.current.y) < 10;

    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      panStart.current = null;
      setGesturing(false);
    }

    if (wasSingleTap) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        toggleDoubleTapZoom();
        lastTap.current = 0;
      } else {
        lastTap.current = now;
        if (scale === 1) onClose();
      }
    }
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    zoomTo(scale * (1 - e.deltaY * 0.01));
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/95 touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-cream/10 text-cream flex items-center justify-center backdrop-blur-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>

      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: gesturing ? "none" : "transform 150ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
