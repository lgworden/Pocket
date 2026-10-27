"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// Crop step for a feed post. Sits between picking a photo and the filter step:
// an Instagram-style fixed frame with drag-to-pan and a zoom slider, rather than
// a resizable crop box — much more reliable on touch than dragging corner
// handles. Skippable: the default view is the full uncropped photo ("Original"
// aspect, zoom 1), so a user who doesn't touch anything still gets their whole
// photo through untouched.
const ASPECT_OPTIONS: { id: string; label: string; ratio: number | null }[] = [
  { id: "original", label: "Original", ratio: null },
  { id: "square", label: "Square", ratio: 1 },
  { id: "portrait", label: "Portrait", ratio: 4 / 5 },
];

const MAX_ZOOM = 3;

function clampOffset(
  o: { x: number; y: number },
  w: number,
  h: number,
  frameW: number,
  frameH: number
) {
  const minX = Math.min(0, frameW - w);
  const minY = Math.min(0, frameH - h);
  return {
    x: Math.min(0, Math.max(minX, o.x)),
    y: Math.min(0, Math.max(minY, o.y)),
  };
}

export default function PhotoCropper({
  src,
  onCancel,
  onDone,
}: {
  src: string; // data URL of the source photo
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  const [loaded, setLoaded] = useState(false);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [aspectId, setAspectId] = useState("original");
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const ratio =
    ASPECT_OPTIONS.find((a) => a.id === aspectId)?.ratio ??
    (naturalW && naturalH ? naturalW / naturalH : 1);
  const frameH = ratio ? frameW / ratio : 0;

  // Preload the source into an off-DOM <img> we can hand straight to the canvas crop.
  useEffect(() => {
    const im = new Image();
    im.onload = () => {
      imgRef.current = im;
      setNaturalW(im.naturalWidth);
      setNaturalH(im.naturalHeight);
      setLoaded(true);
    };
    im.src = src;
  }, [src]);

  // Track the frame's available width so the crop box fills the modal.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setFrameW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const coverScale = useMemo(
    () => (naturalW && naturalH && frameW && frameH ? Math.max(frameW / naturalW, frameH / naturalH) : 0),
    [naturalW, naturalH, frameW, frameH]
  );
  const effScale = coverScale * zoom;
  const dispW = naturalW * effScale;
  const dispH = naturalH * effScale;

  // Aspect change (or the frame/image becoming measurable) recenters the view at
  // full-cover zoom rather than trying to carry over a pan/zoom that may no
  // longer make sense against the new frame shape.
  useEffect(() => {
    if (!frameW || !frameH || !naturalW || !naturalH) return;
    const scale = Math.max(frameW / naturalW, frameH / naturalH);
    const w = naturalW * scale;
    const h = naturalH * scale;
    setZoom(1);
    setOffset({ x: (frameW - w) / 2, y: (frameH - h) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectId, frameW, frameH, naturalW, naturalH]);

  function handleZoomChange(raw: number) {
    const next = Math.min(MAX_ZOOM, Math.max(1, raw));
    if (coverScale > 0) {
      const scalePrev = coverScale * zoom;
      const scaleNext = coverScale * next;
      // Keep the same image point under the frame's center while zooming.
      const imgCx = (frameW / 2 - offset.x) / scalePrev;
      const imgCy = (frameH / 2 - offset.y) / scalePrev;
      const w = naturalW * scaleNext;
      const h = naturalH * scaleNext;
      setOffset(
        clampOffset(
          { x: frameW / 2 - imgCx * scaleNext, y: frameH / 2 - imgCy * scaleNext },
          w,
          h,
          frameW,
          frameH
        )
      );
    }
    setZoom(next);
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(
      clampOffset(
        { x: dragRef.current.origX + dx, y: dragRef.current.origY + dy },
        dispW,
        dispH,
        frameW,
        frameH
      )
    );
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function apply() {
    if (!imgRef.current || !frameW || !frameH || !effScale) return;
    const sx = -offset.x / effScale;
    const sy = -offset.y / effScale;
    const sWidth = frameW / effScale;
    const sHeight = frameH / effScale;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sWidth));
    canvas.height = Math.max(1, Math.round(sHeight));
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imgRef.current, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    onDone(canvas.toDataURL("image/jpeg", 0.92));
  }

  return (
    <div className="space-y-4">
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-xl bg-ink/5 touch-none select-none cursor-grab active:cursor-grabbing"
        style={{ height: frameH || undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {loaded && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="crop preview"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="absolute pointer-events-none"
            style={{ left: offset.x, top: offset.y, width: dispW, height: dispH, maxWidth: "none" }}
          />
        )}
      </div>
      <p className="text-xs text-slate/60 -mt-2">drag to reposition</p>

      {/* Aspect ratio */}
      <div>
        <label className="text-xs font-ui font-semibold text-slate tracking-wide">
          Aspect
        </label>
        <div className="mt-2 flex gap-2">
          {ASPECT_OPTIONS.map((a) => {
            const active = a.id === aspectId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAspectId(a.id)}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  active ? "border-brown bg-brown/10 text-ink" : "border-slate/20 text-slate"
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zoom */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            Zoom
          </label>
          <span className="text-xs text-slate/70">{Math.round(zoom * 100)}%</span>
        </div>
        <input
          type="range"
          min={100}
          max={MAX_ZOOM * 100}
          value={Math.round(zoom * 100)}
          onChange={(e) => handleZoomChange(Number(e.target.value) / 100)}
          className="mt-1 w-full accent-brown"
          aria-label="Zoom"
        />
      </div>

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
          Use crop
        </button>
      </div>
    </div>
  );
}
