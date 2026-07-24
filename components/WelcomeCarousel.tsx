"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function PocketIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 13h22l-3 15a3 3 0 0 1-3 2.4H15a3 3 0 0 1-3-2.4L9 13Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13 18c2 3 4 3 7 3s5 0 7-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function HangerIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 8a3 3 0 1 1 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 11v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 14 6 24a2 2 0 0 0 1 3.6h26A2 2 0 0 0 34 24L20 14Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 21h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9Z" fill="currentColor" />
      <circle cx="31" cy="12" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="10" cy="28" r="1.6" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 32S6 23.5 6 14.5A7.5 7.5 0 0 1 20 10a7.5 7.5 0 0 1 14 4.5C34 23.5 20 32 20 32Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SLIDES = [
  {
    icon: <PocketIcon />,
    title: "welcome to pocket",
    body: "your closet, your daily stylist, and your friends. all in the back of your pocket.",
  },
  {
    icon: <HangerIcon />,
    title: "catalog your closet",
    body: "snap a photo and we'll draft the details. reference your favorite items to create new looks.",
  },
  {
    icon: <SparkleIcon />,
    title: "your daily stylist",
    body: "give us a brief description of your day and we'll pick your outfit based on your preferences — matched to the weather and your calendar.",
  },
  {
    icon: <HeartIcon />,
    title: "share the fits",
    body: "take a quick snap to share your OOTD with friends.",
  },
];

export default function WelcomeCarousel() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const isLast = index === SLIDES.length - 1;

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walkthrough_completed: true }),
      });
    } finally {
      router.push("/");
    }
  }

  function next() {
    if (isLast) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 pt-6 pb-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={finish}
          disabled={finishing}
          className="text-xs font-ui text-slate/60 px-2 py-1"
        >
          skip
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 px-2">
        <div className="w-24 h-24 rounded-full bg-panel shadow-soft flex items-center justify-center text-blue">
          {SLIDES[index].icon}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl">{SLIDES[index].title}</h1>
          <p className="text-sm text-ink/70 max-w-xs mx-auto leading-relaxed">
            {SLIDES[index].body}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-5">
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-ink" : "w-1.5 bg-slate/25"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn-primary w-full max-w-xs"
          onClick={next}
          disabled={finishing}
        >
          {isLast ? (finishing ? "taking you in..." : "get started") : "next"}
        </button>
      </div>
    </main>
  );
}
