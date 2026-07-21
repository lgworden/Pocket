import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import PackInteractive from "@/components/PackInteractive";

export const dynamic = "force-dynamic";

export default async function PackPage() {
  const user = await requireOnboarded();

  return (
    <main className="px-4 pt-6 space-y-6 pb-28">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-xs font-ui text-slate/60 hover:text-slate">
            ← stylist
          </Link>
          <h1 className="text-2xl mt-1">Pack my bags ✈️</h1>
          <p className="text-sm text-ink/60 mt-1">
            One tiny carry-on, {user.display_name || user.name}. The 3·3·3 method turns a
            few pieces into a whole trip's worth of outfits.
          </p>
        </div>
      </header>

      <PackInteractive />

      <BottomNav />
    </main>
  );
}
