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
      className="btn-primary relative shrink-0 flex items-center justify-center"
    >
      ✨
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose ring-2 ring-ink" />
      )}
    </Link>
  );
}
