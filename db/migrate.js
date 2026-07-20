// Run with: npm run db:migrate
// Applies schema.sql and migrations against DATABASE_URL. Idempotent-ish: safe to run once on a fresh DB.
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Load .env.local
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Ensure plpgsql is available (required for functions)
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS "plpgsql"');
  } catch (err) {
    console.log("⚠ plpgsql extension not available (expected on some embedded Postgres installations)");
  }

  // Apply schema.sql only on a fresh database. schema.sql uses bare CREATE TABLE
  // (no IF NOT EXISTS), so re-running it against an existing DB throws — skip it
  // once the DB is initialised and rely on the idempotent migrations below. This
  // makes `db:migrate` safe to run on every deploy (e.g. a Railway pre-deploy cmd).
  const { rows } = await pool.query("SELECT to_regclass('public.users') AS t");
  if (rows[0].t === null) {
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    console.log("Fresh database — applying schema.sql ...");
    await pool.query(schema);
  } else {
    console.log("Existing database — skipping schema.sql, applying migrations only ...");
  }

  // Apply SQL functions
  const refreshUserPreferences = fs.readFileSync(
    path.join(__dirname, "functions", "refresh_user_preferences.sql"),
    "utf8"
  );
  console.log("Applying refresh_user_preferences function ...");
  await pool.query(refreshUserPreferences);

  // Apply migrations in order
  const migrations = [
    path.join(__dirname, "001_add_preferences_fields.sql"),
    path.join(__dirname, "002_add_user_preference_analysis.sql"),
    path.join(__dirname, "003_add_onboarding_completed.sql"),
    path.join(__dirname, "004_add_notification_preferences.sql"),
    path.join(__dirname, "005_add_brand.sql"),
    path.join(__dirname, "006_add_feed.sql"),
    path.join(__dirname, "007_add_notifications.sql"),
    path.join(__dirname, "008_add_bag_category.sql"),
    path.join(__dirname, "009_add_home_address.sql"),
    path.join(__dirname, "010_add_friends.sql"),
    path.join(__dirname, "011_add_item_sketch.sql"),
    path.join(__dirname, "012_add_profile_fields.sql"),
    path.join(__dirname, "013_add_avatar.sql"),
  ];

  for (const migrationPath of migrations) {
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, "utf8");
      const filename = path.basename(migrationPath);
      console.log(`Applying ${filename} ...`);
      await pool.query(migration);
    }
  }

  console.log("All migrations applied successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
