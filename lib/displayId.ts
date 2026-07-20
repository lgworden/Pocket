import pool from "./db";

const CATEGORY_PREFIX: Record<string, string> = {
  top: "TOP",
  bottom: "BOTTOM",
  dress: "DRESS",
  outerwear: "OUTER",
  shoes: "SHOE",
  bag: "BAG",
  accessory: "ACC",
};

// e.g. TOP-0042, SHOE-0007 — sequence is per-category, zero-padded to 4 digits.
export async function nextDisplayId(category: string): Promise<string> {
  const prefix = CATEGORY_PREFIX[category];
  if (!prefix) throw new Error(`Unknown item category: ${category}`);

  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(substring(display_id from '\\d+$')::int), 0) + 1 AS next
     FROM items WHERE display_id LIKE $1`,
    [`${prefix}-%`]
  );
  const next = rows[0].next as number;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}
