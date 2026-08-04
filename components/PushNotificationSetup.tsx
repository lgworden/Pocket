"use client";

import { useEffect, useState } from "react";

// Web Push opt-in: registers the service worker, requests browser/OS
// permission, and subscribes with the VAPID public key. Lives inside
// NotificationsModal alongside the in-app notification type picker — the
// same "Notifications" surface, just the delivery channel for it.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status = "unsupported" | "checking" | "denied" | "off" | "on";

export default function PushNotificationSetup() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  async function enable() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setStatus("unsupported");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setStatus("on");
    } catch {
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") return null;

  return (
    <div className="flex items-center justify-between gap-3 border border-slate/20 rounded-lg p-3">
      <div>
        <p className="text-sm font-ui font-semibold text-ink">Push to home screen</p>
        <p className="text-xs text-slate/60 mt-0.5">
          {status === "unsupported" && "Not supported on this browser."}
          {status === "denied" && "Blocked — enable notifications for this site in your browser settings."}
          {status === "on" && "On — you'll get alerts even when the app is closed."}
          {status === "off" && "Off — alerts only show inside the app."}
        </p>
      </div>
      {(status === "on" || status === "off") && (
        <button
          className="btn-secondary shrink-0 text-xs px-3 py-1.5"
          onClick={status === "on" ? disable : enable}
          disabled={busy}
        >
          {busy ? "..." : status === "on" ? "turn off" : "turn on"}
        </button>
      )}
    </div>
  );
}
