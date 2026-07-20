import { Pool } from "pg";

// Railway injects DATABASE_URL automatically once a Postgres plugin is attached.
// Enable SSL for any remote host (Railway internal/proxy, Neon, etc.) and disable
// it for local Postgres or when the URL explicitly opts out with sslmode=disable.
const url = process.env.DATABASE_URL ?? "";
const isLocal = url === "" || /localhost|127\.0\.0\.1/.test(url);
const sslDisabled = /sslmode=disable/.test(url);

const pool = new Pool({
  connectionString: url || undefined,
  ssl: isLocal || sslDisabled ? false : { rejectUnauthorized: false },
});

export default pool;
