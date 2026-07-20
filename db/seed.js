// Run with: npm run db:seed
// Creates the single seed user for v1 (see build plan: "hardcoded/seeded user row
// is fine for v1"). Safe to run more than once — no-ops if the user already exists.
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const email = process.env.SEED_USER_EMAIL || "me@closetstylist.app";
  const name = process.env.SEED_USER_NAME || "Mira";
  const location = process.env.SEED_USER_LOCATION || "Washington, DC";

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    console.log(`Seed user already exists: ${email} (${existing.rows[0].id})`);
  } else {
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, location) VALUES ($1, $2, $3) RETURNING id",
      [name, email, location]
    );
    console.log(`Created seed user: ${email} (${rows[0].id})`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
