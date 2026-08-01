"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Icon-only entry point to /notifications — symbol matches the app's
// warm/soft theme rather than a text label or a full nav tab.
export default function NotificationButton() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.unreadCount ?? 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      aria-label="notifications"
      className="w-8 h-8 rounded-full flex items-center justify-center shadow-soft-sm bg-panel border border-slate/20 text-ink relative shrink-0"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2 L11.5 8.5 L18 10 L11.5 11.5 L10 18 L8.5 11.5 L2 10 L8.5 8.5 Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-rose ring-2 ring-panel" />
      )}
    </Link>
  );
}
