"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Feed" },
  { href: "/closet", label: "Closet" },
  { href: "/stylist", label: "Digest" },
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
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={tabClass(item.href)}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
