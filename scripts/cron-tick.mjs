// Invoked by the Railway cron service on a schedule (see railway.cron.json).
// Hits this app's own /api/cron/tick with the shared secret.
const url = process.env.CRON_TICK_URL;
const secret = process.env.CRON_SECRET;

if (!url || !secret) {
  console.error("CRON_TICK_URL and CRON_SECRET must both be set");
  process.exit(1);
}

const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});
const body = await res.text();
console.log(res.status, body);

if (!res.ok) process.exit(1);
