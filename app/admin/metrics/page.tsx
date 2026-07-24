import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

function isAdmin(email: string): boolean {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

async function getSignupsByDay() {
  const { rows } = await pool.query<{ day: string; count: string }>(
    `SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS count
     FROM users GROUP BY 1 ORDER BY 1 DESC LIMIT 30`
  );
  return rows;
}

async function getActiveCounts() {
  const { rows } = await pool.query<{ dau: string; wau: string }>(
    `SELECT
       (SELECT COUNT(DISTINCT user_id) FROM events WHERE created_at >= now() - interval '1 day') AS dau,
       (SELECT COUNT(DISTINCT user_id) FROM events WHERE created_at >= now() - interval '7 days') AS wau`
  );
  return rows[0];
}

async function getRetention() {
  const { rows } = await pool.query(
    `WITH signups AS (SELECT id AS user_id, created_at::date AS signup_date FROM users),
          activity AS (SELECT DISTINCT user_id, created_at::date AS active_date FROM events)
     SELECT
       COUNT(*) FILTER (WHERE s.signup_date <= CURRENT_DATE - 1) AS d1_eligible,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM activity a WHERE a.user_id = s.user_id AND a.active_date = s.signup_date + 1)) AS d1_retained,
       COUNT(*) FILTER (WHERE s.signup_date <= CURRENT_DATE - 7) AS d7_eligible,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM activity a WHERE a.user_id = s.user_id AND a.active_date = s.signup_date + 7)) AS d7_retained,
       COUNT(*) FILTER (WHERE s.signup_date <= CURRENT_DATE - 30) AS d30_eligible,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM activity a WHERE a.user_id = s.user_id AND a.active_date = s.signup_date + 30)) AS d30_retained
     FROM signups s`
  );
  return rows[0];
}

async function getFeatureUsage() {
  const { rows } = await pool.query<{ event_type: string; count: string }>(
    `SELECT event_type, COUNT(*) AS count FROM events GROUP BY event_type ORDER BY count DESC`
  );
  return rows;
}

async function getInviteFunnel() {
  const { rows } = await pool.query<{ codes_generated: string; accepted: string }>(
    `SELECT
       (SELECT COUNT(*) FROM invites) AS codes_generated,
       (SELECT COUNT(*) FROM events WHERE event_type = 'invite_accepted') AS accepted`
  );
  return rows[0];
}

async function getCompletionRates() {
  const { rows } = await pool.query<{ onboarding_done: string; walkthrough_done: string; total: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE onboarding_completed) AS onboarding_done,
       COUNT(*) FILTER (WHERE walkthrough_completed) AS walkthrough_done,
       COUNT(*) AS total
     FROM users`
  );
  return rows[0];
}

function pct(n: string | number, d: string | number): string {
  const num = Number(n);
  const den = Number(d);
  if (den === 0) return "n/a";
  return `${((num / den) * 100).toFixed(0)}%`;
}

export default async function MetricsPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) notFound();

  const [signups, active, retention, features, invites, completion] = await Promise.all([
    getSignupsByDay(),
    getActiveCounts(),
    getRetention(),
    getFeatureUsage(),
    getInviteFunnel(),
    getCompletionRates(),
  ]);

  const th = "text-left font-semibold p-2 border-b border-gray-300";
  const td = "p-2 border-b border-gray-200";

  return (
    <main className="max-w-3xl mx-auto p-6 font-sans text-sm text-gray-900 bg-white space-y-8">
      <h1 className="text-xl font-bold">Metrics</h1>

      <section>
        <h2 className="font-semibold mb-2">Active users</h2>
        <p>DAU: {active.dau} &middot; WAU: {active.wau}</p>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Retention</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Window</th>
              <th className={th}>Eligible</th>
              <th className={th}>Retained</th>
              <th className={th}>Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>D1</td>
              <td className={td}>{retention.d1_eligible}</td>
              <td className={td}>{retention.d1_retained}</td>
              <td className={td}>{pct(retention.d1_retained, retention.d1_eligible)}</td>
            </tr>
            <tr>
              <td className={td}>D7</td>
              <td className={td}>{retention.d7_eligible}</td>
              <td className={td}>{retention.d7_retained}</td>
              <td className={td}>{pct(retention.d7_retained, retention.d7_eligible)}</td>
            </tr>
            <tr>
              <td className={td}>D30</td>
              <td className={td}>{retention.d30_eligible}</td>
              <td className={td}>{retention.d30_retained}</td>
              <td className={td}>{pct(retention.d30_retained, retention.d30_eligible)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Feature usage (all-time)</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Event</th>
              <th className={th}>Count</th>
            </tr>
          </thead>
          <tbody>
            {features.length === 0 ? (
              <tr>
                <td className={td} colSpan={2}>No events recorded yet.</td>
              </tr>
            ) : (
              features.map((f) => (
                <tr key={f.event_type}>
                  <td className={td}>{f.event_type}</td>
                  <td className={td}>{f.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Invite funnel</h2>
        <p>
          Friends who generated a link: {invites.codes_generated} &middot; Invites accepted:{" "}
          {invites.accepted}
        </p>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Onboarding / walkthrough completion</h2>
        <p>
          Onboarding: {completion.onboarding_done}/{completion.total} (
          {pct(completion.onboarding_done, completion.total)}) &middot; Walkthrough:{" "}
          {completion.walkthrough_done}/{completion.total} (
          {pct(completion.walkthrough_done, completion.total)})
        </p>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Signups by day (last 30 days with signups)</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Day</th>
              <th className={th}>Signups</th>
            </tr>
          </thead>
          <tbody>
            {signups.length === 0 ? (
              <tr>
                <td className={td} colSpan={2}>No signups yet.</td>
              </tr>
            ) : (
              signups.map((s) => (
                <tr key={s.day}>
                  <td className={td}>{new Date(s.day).toLocaleDateString()}</td>
                  <td className={td}>{s.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
