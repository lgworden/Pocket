// Grant or revoke hidden "designer" status — the only thing that makes an
// account followable (see lib/designers.ts).
//
//   npm run designer:grant  -- <username|email>
//   npm run designer:revoke -- <username|email>
//   npm run designer:list
//
// Deliberately a CLI and not an admin screen: the status is invisible to users
// by design, and an in-app toggle is the fastest way to leak that it exists.
// Revoking leaves existing `follows` rows alone — it stops new follows and
// hides the follow button, but doesn't silently sever anyone's connections.
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, "..", ".env.local") });

const [, , command, handle] = process.argv;

if (!["grant", "revoke", "list"].includes(command)) {
  console.error("Usage: node scripts/designer.mjs <grant|revoke|list> [username|email]");
  process.exit(1);
}
if (command !== "list" && !handle) {
  console.error(`Usage: node scripts/designer.mjs ${command} <username|email>`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  if (command === "list") {
    const { rows } = await pool.query(
      `SELECT COALESCE(display_name, name) AS name, username, email, designer_since
         FROM users WHERE designer_since IS NOT NULL ORDER BY designer_since`
    );
    if (rows.length === 0) {
      console.log("No designers.");
    } else {
      for (const r of rows) {
        console.log(`${r.name} (${r.username ?? r.email ?? "—"}) since ${r.designer_since.toISOString()}`);
      }
    }
  } else {
    const { rows } = await pool.query(
      `UPDATE users
          SET designer_since = ${command === "grant" ? "COALESCE(designer_since, now())" : "NULL"}
        WHERE lower(username) = lower($1) OR lower(email) = lower($1)
        RETURNING COALESCE(display_name, name) AS name, designer_since`,
      [handle]
    );
    if (rows.length === 0) {
      console.error(`No user matching "${handle}".`);
      process.exit(1);
    }
    for (const r of rows) {
      console.log(`${r.name}: ${r.designer_since ? "designer" : "not a designer"}`);
    }
  }
} finally {
  await pool.end();
}
