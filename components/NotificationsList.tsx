"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  type: "daily_digest" | "weekly_style_analysis" | "weekly_feed_summary" | "ootd_reminder";
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICON: Record<Notification["type"], string> = {
  daily_digest: "☀️",
  weekly_style_analysis: "🧵",
  weekly_feed_summary: "📸",
  ootd_reminder: "📣",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsList({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function open(n: Notification) {
    if (!n.read_at) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      );
      fetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }

  if (notifications.length === 0) {
    return (
      <div className="card text-sm text-slate/70">
        Nothing here yet — your daily digest, weekly recaps, and reminders will show up in this list.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <button className="btn-secondary text-xs" onClick={readAll}>
          mark all as read
        </button>
      )}
      {notifications.map((n) => (
        <button
          key={n.id}
          onClick={() => open(n)}
          className={`card w-full text-left flex gap-3 items-start ${
            n.read_at ? "opacity-70" : "border-blue/40 bg-blue/5"
          }`}
        >
          <span className="text-xl leading-none mt-0.5">{TYPE_ICON[n.type]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-ui font-semibold text-ink">{n.title}</p>
              {!n.read_at && <span className="w-2 h-2 rounded-full bg-blue shrink-0" />}
            </div>
            <p className="text-sm text-ink/70 mt-1">{n.body}</p>
            <p className="text-xs text-slate/50 mt-1.5">{timeAgo(n.created_at)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
