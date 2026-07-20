"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const OCCASIONS = ["workwear", "casual", "going-out", "athletic", "lounge"];
const PROVENANCES = ["thrifted", "retail", "gifted", "secondhand", "handmade"];
const STATUSES = ["active", "archived", "donated"];

export default function ClosetFilters({ colors }: { colors: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function select(key: string) {
    return searchParams.get(key) ?? "";
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="tag tag-outline"
        value={select("occasion")}
        onChange={(e) => setFilter("occasion", e.target.value)}
      >
        <option value="">All occasions</option>
        {OCCASIONS.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>

      <select
        className="tag tag-outline"
        value={select("color")}
        onChange={(e) => setFilter("color", e.target.value)}
      >
        <option value="">All colors</option>
        {colors.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        className="tag tag-outline"
        value={select("provenance")}
        onChange={(e) => setFilter("provenance", e.target.value)}
      >
        <option value="">All provenance</option>
        {PROVENANCES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select
        className="tag tag-outline"
        value={select("status")}
        onChange={(e) => setFilter("status", e.target.value)}
      >
        <option value="">Active + donated</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
