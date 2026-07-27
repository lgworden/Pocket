"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Left-of-centre / right-of-centre — the compose action sits between them as
// its own raised button, not a fifth equal tab.
const LEFT_ITEMS = [
  { href: "/", label: "Feed" },
  { href: "/stylist", label: "Stylist" },
];
const RIGHT_ITEMS = [
  { href: "/closet", label: "Closet" },
  { href: "/preferences", label: "Settings" },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const tabClass = (href: string) =>
    `text-sm font-ui px-3 py-2 transition-colors ${
      isActive(href)
        ? "text-ink font-semibold border-b-2 border-blue"
        : "text-slate/60 hover:text-slate"
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-panel border-t border-slate/15 rounded-t-2xl shadow-soft-sm flex items-center justify-around py-3 px-4">
      {LEFT_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={tabClass(item.href)}>
          {item.label}
        </Link>
      ))}

      {/* Persistent compose action — reachable from any screen, always lands
          on the feed with the post composer already open. */}
      <Link
        href="/?compose=1"
        aria-label="New post"
        className="shrink-0 w-11 h-11 -mt-6 rounded-full bg-ink text-cream flex items-center justify-center text-2xl leading-none shadow-soft-sm"
      >
        +
      </Link>

      {RIGHT_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={tabClass(item.href)}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
