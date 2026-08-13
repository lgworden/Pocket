"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ITEMS = [
  { href: "/", label: "Feed" },
  { href: "/closet", label: "Closet" },
  { href: "/stylist", label: "Digest" },
  { href: "/preferences", label: "Settings" },
];

// How far the page has to move in one direction before the bar reacts — keeps
// it from flickering on the small jitter of a momentum scroll.
const THRESHOLD = 8;

export default function BottomNav() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  // Scrolling down slides the whole bar off-screen (downward, since it's
  // bottom-docked); scrolling up brings it back, fully opaque. Near the top
  // of the page it's always shown.
  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < THRESHOLD) return;
      lastY.current = y;

      if (y < 40) {
        setHidden(false);
      } else {
        setHidden(delta > 0);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  // The feed's content column is wider than the app-wide max-w-md body from
  // `md` up (see app/page.tsx) — match it there so the bar spans the same
  // width as the collage above it instead of looking stranded in the middle.
  const isFeed = pathname === "/";

  return (
    // Docked to the bottom at every breakpoint, where it sits under the thumb
    // on a phone and stays anchored to the content it belongs to on desktop.
    <nav
      aria-hidden={hidden}
      className={`fixed bottom-0 left-0 right-0 z-40 mx-auto bg-panel opacity-100 border-t border-slate/25 rounded-t-2xl shadow-soft flex items-center justify-around py-3 px-4 will-change-transform transition-transform duration-200 ease-out ${
        isFeed ? "max-w-md md:max-w-[640px] lg:max-w-[760px]" : "max-w-md"
      } ${hidden ? "translate-y-full pointer-events-none" : "translate-y-0"}`}
    >
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={tabClass(item.href)}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
