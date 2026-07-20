import { notFound } from "next/navigation";
import Link from "next/link";
import pool from "@/lib/db";
import { requireOnboarded } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import ItemPhotoDisplay from "@/components/ItemPhotoDisplay";
import ItemSketch from "@/components/ItemSketch";
import ItemWearStats from "@/components/ItemWearStats";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  display_id: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  occasions: string[];
  tags: string[];
  colors: string[];
  warmth: number | null;
  formality: number | null;
  seasons: string[];
  provenance: string | null;
  cost: string | null;
  status: string;
  photos: string[];
  sketch: string | null;
  date_added: string;
  wear_count: string;
  last_worn: Date | null;
};

async function getItem(userId: string, id: string): Promise<Item | null> {
  const { rows } = await pool.query(
    `SELECT i.*, COALESCE(s.wear_count, 0) AS wear_count, s.last_worn
     FROM items i
     LEFT JOIN item_wear_stats s ON s.item_id = i.id
     WHERE i.id = $1 AND i.user_id = $2`,
    [id, userId]
  );
  return rows[0] ?? null;
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const user = await requireOnboarded();
  const userId = user.id;
  const item = await getItem(userId, params.id);
  if (!item) notFound();

  const wearCount = Number(item.wear_count);
  const costPerWear =
    item.cost && wearCount > 0 ? (Number(item.cost) / wearCount).toFixed(2) : null;

  return (
    <main className="px-4 pt-6 space-y-4">
      <Link href="/closet" className="text-sm text-slate">
        ← Back to closet
      </Link>

      <ItemPhotoDisplay itemId={item.id} photos={item.photos} itemName={item.name} />

      <ItemSketch
        itemId={item.id}
        initialSketch={item.sketch}
        hasPhoto={item.photos.length > 0}
      />

      <header>
        <p className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
          {item.display_id}
        </p>
        <h1 className="text-2xl mt-1">{item.name}</h1>
      </header>

      <div className="card grid grid-cols-2 gap-4">
        <Field label="Brand" value={item.brand ?? ""} />
        <Field label="Category" value={item.category} />
        <Field label="Subcategory" value={item.subcategory ?? ""} />
        <Field label="Colors" value={item.colors.join(", ")} />
        <Field label="Provenance" value={item.provenance ?? ""} />
        <Field label="Warmth" value={item.warmth ? `${item.warmth} / 5` : ""} />
        <Field label="Formality" value={item.formality ? `${item.formality} / 5` : ""} />
        <Field label="Occasions" value={item.occasions.join(", ")} />
        <Field label="Seasons" value={item.seasons.join(", ")} />
        <Field label="Tags" value={item.tags.join(", ")} />
        <Field label="Status" value={item.status} />
      </div>

      <ItemWearStats
        itemId={item.id}
        wearCount={wearCount}
        lastWorn={item.last_worn ? item.last_worn.toISOString() : null}
        cost={item.cost}
      />

      <BottomNav />
    </main>
  );
}
