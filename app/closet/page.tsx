import Link from "next/link";
import pool from "@/lib/db";
import { requireOnboarded } from "@/lib/auth";
import ClosetFilters from "@/components/ClosetFilters";
import BottomNav from "@/components/BottomNav";
import AddPhotoButton from "@/components/AddPhotoButton";
import ClosetHub from "@/components/closet/ClosetHub";
import type { LoggedFit } from "@/components/closet/LogFitComposer";

export const dynamic = "force-dynamic";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "dress", label: "Dresses" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "bag", label: "Bags" },
  { value: "accessory", label: "Accessories" },
];

const MISC_CATEGORY = "misc";

type Item = {
  id: string;
  display_id: string;
  name: string;
  photos: string[];
};

async function getCategoryCounts(userId: string): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ category: string; count: string }>(
    `SELECT category, COUNT(*) AS count FROM items
     WHERE user_id = $1 AND status != 'archived'
     GROUP BY category`,
    [userId]
  );
  return Object.fromEntries(rows.map((r) => [r.category, Number(r.count)]));
}

async function getItemsInCategory(
  userId: string,
  category: string,
  searchParams: Record<string, string | string[] | undefined>,
  miscCategories: string[]
) {
  const conditions: string[] = ["user_id = $1"];
  const values: unknown[] = [userId];

  if (category === MISC_CATEGORY) {
    if (miscCategories.length === 0) {
      conditions.push("false");
    } else {
      values.push(miscCategories);
      conditions.push(`category = ANY($${values.length}::item_category[])`);
    }
  } else {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  } else {
    conditions.push(`status != 'archived'`);
  }

  const occasion = typeof searchParams.occasion === "string" ? searchParams.occasion : undefined;
  if (occasion) {
    values.push(occasion);
    conditions.push(`$${values.length} = ANY(occasions)`);
  }

  const color = typeof searchParams.color === "string" ? searchParams.color : undefined;
  if (color) {
    values.push(color);
    conditions.push(`$${values.length} = ANY(colors)`);
  }

  const provenance = typeof searchParams.provenance === "string" ? searchParams.provenance : undefined;
  if (provenance) {
    values.push(provenance);
    conditions.push(`provenance = $${values.length}`);
  }

  const { rows } = await pool.query<Item>(
    `SELECT id, display_id, name, photos FROM items
     WHERE ${conditions.join(" AND ")} ORDER BY date_added DESC`,
    values
  );
  return rows;
}

async function getDistinctColors(userId: string) {
  const { rows } = await pool.query<{ color: string }>(
    `SELECT DISTINCT unnest(colors) AS color FROM items WHERE user_id = $1 ORDER BY color`,
    [userId]
  );
  return rows.map((r) => r.color);
}

type RecentFitRow = {
  id: string;
  photo: string;
  notes: string | null;
  created_at: string;
  tagged_items: { id: string; display_id: string; name: string }[];
  shared_to_feed: boolean;
};

async function getRecentFits(userId: string): Promise<LoggedFit[]> {
  const { rows } = await pool.query<RecentFitRow>(
    `SELECT
       l.id, l.photo, l.notes, l.created_at,
       (
         SELECT COALESCE(jsonb_agg(jsonb_build_object('id', i.id, 'display_id', i.display_id, 'name', i.name)), '[]')
         FROM items i WHERE i.id = ANY(l.item_ids)
       ) AS tagged_items,
       EXISTS (SELECT 1 FROM feed_posts fp WHERE fp.outfit_log_id = l.id) AS shared_to_feed
     FROM outfit_logs l
     WHERE l.user_id = $1 AND l.photo IS NOT NULL
     ORDER BY l.created_at DESC
     LIMIT 30`,
    [userId]
  );
  return rows;
}

export default async function ClosetPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireOnboarded();
  const userId = user.id;
  const category = typeof searchParams.category === "string" ? searchParams.category : undefined;

  const [counts, recentFits] = await Promise.all([
    getCategoryCounts(userId),
    category ? Promise.resolve(null) : getRecentFits(userId),
  ]);

  // A category only earns its own filter chip once it has at least two items;
  // single-item categories get folded into "Miscellaneous" instead.
  const miscCategories = CATEGORIES.filter((c) => (counts[c.value] ?? 0) === 1).map(
    (c) => c.value
  );

  const categoryLabel =
    category === MISC_CATEGORY
      ? "Miscellaneous"
      : category
      ? CATEGORIES.find((c) => c.value === category)?.label
      : "Your closet";

  return (
    <main className="px-4 pt-6 space-y-4">
      <header>
        <p className="text-xs font-ui font-semibold text-slate tracking-wide">
          Closet
        </p>
        <h1 className="text-2xl mt-1">{categoryLabel}</h1>
      </header>

      <ClosetHub initialFits={recentFits ?? []} showMoodBoard={!category}>
        <div className="space-y-4">
          {!category && (
            <Link
              href="/add-item/from-outfit"
              className="card flex items-center justify-between gap-3 bg-blue/10 border-blue/30 hover:bg-blue/20 transition-colors"
            >
              <div>
                <p className="text-sm font-ui font-semibold text-ink">got an outfit photo?</p>
                <p className="text-xs text-slate/70 mt-0.5">
                  log my items — we'll spot each piece and add what's new
                </p>
              </div>
            </Link>
          )}

          <CategoryChipRow
            activeCategory={category}
            counts={counts}
            miscCount={miscCategories.length}
          />

          {category && (
            <CategoryItemList
              userId={userId}
              category={category}
              searchParams={searchParams}
              miscCategories={miscCategories}
            />
          )}
        </div>
      </ClosetHub>

      <BottomNav />
    </main>
  );
}

function CategoryChipRow({
  activeCategory,
  counts,
  miscCount,
}: {
  activeCategory: string | undefined;
  counts: Record<string, number>;
  miscCount: number;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link
        href="/closet"
        className={`tag transition-colors ${
          !activeCategory ? "bg-ink text-cream" : "tag-outline"
        }`}
      >
        All
      </Link>
      {CATEGORIES.filter((c) => (counts[c.value] ?? 0) >= 2).map((c) => (
        <Link
          key={c.value}
          href={`/closet?category=${c.value}`}
          className={`tag transition-colors ${
            activeCategory === c.value ? "bg-ink text-cream" : "tag-outline"
          }`}
        >
          {c.label} <span className="opacity-60">· {counts[c.value]}</span>
        </Link>
      ))}
      {miscCount > 0 && (
        <Link
          href={`/closet?category=${MISC_CATEGORY}`}
          className={`tag transition-colors ${
            activeCategory === MISC_CATEGORY ? "bg-ink text-cream" : "tag-outline"
          }`}
        >
          Miscellaneous <span className="opacity-60">· {miscCount}</span>
        </Link>
      )}
    </div>
  );
}

async function CategoryItemList({
  userId,
  category,
  searchParams,
  miscCategories,
}: {
  userId: string;
  category: string;
  searchParams: Record<string, string | string[] | undefined>;
  miscCategories: string[];
}) {
  const [items, colors] = await Promise.all([
    getItemsInCategory(userId, category, searchParams, miscCategories),
    getDistinctColors(userId),
  ]);

  return (
    <div className="space-y-4">
      <ClosetFilters colors={colors} />

      {items.length === 0 ? (
        <div className="card text-center text-sm text-ink/60">
          No items match those filters yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="card flex items-center gap-3">
              {item.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.photos[0]}
                  alt={item.name}
                  className="w-14 h-14 shrink-0 object-cover rounded-xl"
                />
              ) : (
                <AddPhotoButton itemId={item.id} />
              )}
              <Link
                href={`/closet/${item.id}`}
                className="flex-1 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs text-slate font-ui font-semibold">
                    {item.display_id}
                  </p>
                  <p className="text-sm mt-0.5">{item.name}</p>
                </div>
                <span className="text-slate">→</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
