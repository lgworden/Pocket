import pool from "./db";
import { sendEmail, escapeHtml, type EmailResult } from "./email";
import { TRIP_ACTIVITIES } from "./tripActivities";
import { track } from "./analytics";

// Emails a saved packing plan to its owner, packaged as a "PCKT AIRWAYS"
// boarding pass: trip details as flight details, the 3-3-3 capsule as the
// baggage line, and each outfit as a numbered itinerary row.
//
// The plan is ALWAYS re-read from the recommendations row rather than accepted
// from the client. The request only carries an id, so a hand-rolled POST can't
// push attacker-authored strings through our sender — and the (id, user_id)
// pair means it can't mail somebody else's plan either.

const BRAND = {
  cream: "#FBF8F3",
  panel: "#F3ECE1",
  caramel: "#AD8A64",
  brown: "#7A5C3E",
  oat: "#EADFCF",
  ink: "#2E2924",
  stone: "#8F8577",
} as const;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Iowan Old Style',serif";

type PieceRef = { display_id?: string; name?: string };
type Extra = PieceRef & { reason?: string };
type Outfit = {
  title?: string;
  activity?: string;
  reasoning?: string;
  items?: PieceRef[];
};

type StoredPlan = {
  trip_title?: string;
  packing_tip?: string;
  capsule?: { tops?: PieceRef[]; bottoms?: PieceRef[]; shoes?: PieceRef[]; extras?: Extra[] };
  outfits?: Outfit[];
  dont_forget?: string[];
};

type StoredContext = {
  trip?: { destination?: string; days?: number; activities?: string[]; notes?: string };
  trip_weather?: {
    high?: number;
    low?: number;
    rainy_days?: number;
    conditions?: string[];
    location?: string;
    forecast_days?: number;
  };
};

const activityLabel = (value: string) =>
  TRIP_ACTIVITIES.find((a) => a.value === value)?.label ?? value.replace(/_/g, " ");

// Deliberately permissive: the only real requirements are one @ with something
// either side and no whitespace. Anything stricter rejects valid addresses, and
// the mail provider is the actual arbiter of deliverability anyway.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

// A stable, meaningless-but-fun flight number so the same trip always reprints
// the same pass. Derived from the destination, not random, so a resend matches
// the copy already in the user's inbox.
function flightCode(destination: string, days: number): string {
  let hash = 0;
  for (const ch of `${destination}|${days}`) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return `PK ${100 + (hash % 800)}`;
}

function seatCode(tops: number, bottoms: number, shoes: number): string {
  return `${tops}·${bottoms}·${shoes}`;
}

/** The fake barcode strip along the bottom of the pass — bars of varied width. */
function barcodeHtml(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;

  const bars: string[] = [];
  for (let i = 0; i < 44; i++) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const wide = hash % 3 === 0;
    const dark = hash % 5 !== 0;
    bars.push(
      `<td width="${wide ? 5 : 2}" bgcolor="${dark ? BRAND.ink : "#ffffff"}" ` +
        `style="width:${wide ? 5 : 2}px;height:34px;font-size:0;line-height:0">&nbsp;</td>` +
        `<td width="2" bgcolor="#ffffff" style="width:2px;font-size:0;line-height:0">&nbsp;</td>`
    );
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${bars.join(
    ""
  )}</tr></table>`;
}

/**
 * A label-over-value cell, the boarding-pass idiom for every detail field.
 * `colSpan` keeps the 2-field rows aligned with the 3-field row below them —
 * without it the table resolves to 3 columns and the wide rows don't span.
 */
function fieldHtml(label: string, value: string, width?: string, colSpan?: number): string {
  return `
    <td valign="top"${width ? ` width="${width}"` : ""}${
      colSpan ? ` colspan="${colSpan}"` : ""
    } style="padding:0 16px 14px 0">
      <div style="font:600 9px/1.4 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${BRAND.stone}">
        ${escapeHtml(label)}
      </div>
      <div style="font:500 15px/1.35 ${SANS};color:${BRAND.ink};margin-top:3px">
        ${escapeHtml(value)}
      </div>
    </td>`;
}

function chipHtml(text: string): string {
  return `<span style="display:inline-block;background:${BRAND.panel};border:1px solid ${BRAND.oat};border-radius:999px;padding:4px 10px;margin:0 4px 5px 0;font:500 12px/1.3 ${SANS};color:${BRAND.brown}">${escapeHtml(
    text
  )}</span>`;
}

function pieceLine(p: PieceRef): string {
  const id = (p.display_id ?? "").trim();
  const name = (p.name ?? "").trim();
  if (id && name) return `${id} · ${name}`;
  return id || name || "—";
}

export function buildBoardingPassEmail(args: {
  plan: StoredPlan;
  context: StoredContext;
  passengerName: string;
  to: string;
}): { to: string; subject: string; text: string; html: string } {
  const { plan, context, passengerName, to } = args;

  const trip = context.trip ?? {};
  const weather = context.trip_weather ?? {};
  const capsule = plan.capsule ?? {};

  const destination = (trip.destination || weather.location || "your trip").trim();
  const days = trip.days ?? weather.forecast_days ?? 1;
  const tops = capsule.tops ?? [];
  const bottoms = capsule.bottoms ?? [];
  const shoes = capsule.shoes ?? [];
  const extras = capsule.extras ?? [];
  const outfits = plan.outfits ?? [];
  const dontForget = plan.dont_forget ?? [];

  const flight = flightCode(destination, days);
  // "Lisbon, Portugal" -> "LISBON". The city alone reads like an airport board;
  // truncating the raw string instead gives you "LISBON, PORT".
  const cityCode = (destination.split(",")[0] || destination).trim().toUpperCase().slice(0, 16);
  const seat = seatCode(tops.length, bottoms.length, shoes.length);
  const tempLine =
    weather.high != null && weather.low != null ? `${weather.high}° / ${weather.low}°` : "—";
  const conditions = (weather.conditions ?? []).join(", ").toLowerCase();
  const tripTitle = plan.trip_title || `${days} days in ${destination}`;

  // ---------- plain text ----------
  const rule = "─".repeat(46);
  const textLines: string[] = [
    "PCKT AIRWAYS · BOARDING PASS",
    rule,
    `PASSENGER     ${passengerName}`,
    `DESTINATION   ${destination.toUpperCase()}`,
    `DURATION      ${days} day${days === 1 ? "" : "s"}   ·   ${tempLine}`,
    `FLIGHT        ${flight}        SEAT  ${seat}`,
    rule,
    `CARRY-ON      ${tops.length} tops · ${bottoms.length} bottoms · ${shoes.length} shoes`,
  ];
  if (conditions) textLines.push(`FORECAST      ${conditions}`);
  if (plan.packing_tip) textLines.push("", `"${plan.packing_tip}"`);

  textLines.push("", "YOUR CARRY-ON", rule);
  const textGroup = (label: string, pieces: PieceRef[]) => {
    if (pieces.length === 0) return;
    textLines.push(`${label.toUpperCase()} (${pieces.length})`);
    pieces.forEach((p) => textLines.push(`  · ${pieceLine(p)}`));
  };
  textGroup("tops", tops);
  textGroup("bottoms", bottoms);
  textGroup("shoes", shoes);
  if (extras.length > 0) {
    textLines.push(`EXTRAS (${extras.length})`);
    extras.forEach((e) =>
      textLines.push(`  · ${pieceLine(e)}${e.reason ? ` — ${e.reason}` : ""}`)
    );
  }

  if (outfits.length > 0) {
    textLines.push("", `ITINERARY · ${outfits.length} outfits from one carry-on`, rule);
    outfits.forEach((o, i) => {
      const tag = o.activity ? `  [${activityLabel(o.activity)}]` : "";
      textLines.push(`DAY ${i + 1} · ${o.title || `outfit ${i + 1}`}${tag}`);
      if (o.reasoning) textLines.push(`  "${o.reasoning}"`);
      (o.items ?? []).forEach((p) => textLines.push(`  · ${pieceLine(p)}`));
      textLines.push("");
    });
  }

  if (dontForget.length > 0) {
    textLines.push("DON'T FORGET TO GRAB", rule);
    dontForget.forEach((d) => textLines.push(`  ☐ ${d}`));
  }

  textLines.push("", "sent from pckt · one carry-on, zero stress");
  const text = textLines.join("\n");

  // ---------- html ----------
  const detailRow2 = `${fieldHtml("Flight", flight)}${fieldHtml("Seat", seat)}${fieldHtml(
    "Rainy days",
    String(weather.rainy_days ?? 0)
  )}`;

  const capsuleGroup = (label: string, pieces: PieceRef[]) =>
    pieces.length === 0
      ? ""
      : `
      <tr><td style="padding:0 0 14px">
        <div style="font:600 10px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${BRAND.stone};margin-bottom:6px">
          ${escapeHtml(label)} (${pieces.length})
        </div>
        ${pieces.map((p) => chipHtml(pieceLine(p))).join("")}
      </td></tr>`;

  const extrasHtml =
    extras.length === 0
      ? ""
      : `
      <tr><td style="padding:0 0 4px">
        <div style="font:600 10px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${BRAND.stone};margin-bottom:6px">
          extras for your plans (${extras.length})
        </div>
        ${extras
          .map(
            (e) => `
          <div style="margin-bottom:7px">
            ${chipHtml(pieceLine(e))}
            ${
              e.reason
                ? `<span style="font:400 12px/1.5 ${SANS};color:${BRAND.stone}">${escapeHtml(
                    e.reason
                  )}</span>`
                : ""
            }
          </div>`
          )
          .join("")}
      </td></tr>`;

  const itineraryHtml = outfits
    .map(
      (o, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#ffffff;border:1px solid ${BRAND.oat};border-radius:14px;margin-bottom:10px">
      <tr><td style="padding:14px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font:600 10px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${BRAND.caramel}">
            Day ${i + 1}
          </td>
          <td align="right">
            ${o.activity ? chipHtml(activityLabel(o.activity)) : ""}
          </td>
        </tr></table>
        <div style="font:600 16px/1.35 ${SANS};color:${BRAND.ink};margin:4px 0 0">
          ${escapeHtml(o.title || `outfit ${i + 1}`)}
        </div>
        ${
          o.reasoning
            ? `<div style="font:italic 400 14px/1.5 ${SERIF};color:${BRAND.ink};opacity:.8;margin:6px 0 8px">“${escapeHtml(
                o.reasoning
              )}”</div>`
            : ""
        }
        <div>${(o.items ?? []).map((p) => chipHtml(pieceLine(p))).join("")}</div>
      </td></tr>
    </table>`
    )
    .join("");

  const dontForgetHtml =
    dontForget.length === 0
      ? ""
      : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${BRAND.oat};border-radius:14px;margin-top:18px">
      <tr><td style="padding:16px 18px">
        <div style="font:600 10px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${BRAND.brown}">
          don't forget to grab
        </div>
        ${dontForget
          .map(
            (d) =>
              `<div style="font:400 14px/1.7 ${SANS};color:${BRAND.ink}">☐&nbsp;&nbsp;${escapeHtml(
                d
              )}</div>`
          )
          .join("")}
      </td></tr>
    </table>`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${escapeHtml(tripTitle)}</title>
  <style>
    /* A 600px table can't shrink itself: its own max-width resolves against a
       container the table is what's sizing. So narrow screens get an explicit
       override. Clients that strip <style> (Outlook desktop) are all fixed-width
       desktop anyway, where 600px already fits. */
    @media only screen and (max-width:620px) {
      .pass-shell { width:100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">
    ${escapeHtml(tripTitle)} — ${tops.length} tops, ${bottoms.length} bottoms, ${shoes.length} shoes, ${outfits.length} outfits.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.cream}">
    <tr><td align="center" style="padding:28px 12px 40px">
      <table role="presentation" class="pass-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%">

        <!-- the pass -->
        <tr><td style="background:#ffffff;border:1px solid ${BRAND.oat};border-radius:18px;overflow:hidden">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="${BRAND.caramel}" style="padding:14px 22px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="font:700 13px/1.4 ${SANS};letter-spacing:.18em;text-transform:uppercase;color:#ffffff">
                  ✈&nbsp;&nbsp;pckt airways
                </td>
                <td align="right" style="font:600 10px/1.4 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:#ffffff;opacity:.85">
                  boarding pass
                </td>
              </tr></table>
            </td></tr>

            <tr><td style="padding:22px 22px 4px">
              <div style="font:italic 400 24px/1.25 ${SERIF};color:${BRAND.ink};margin-bottom:18px">
                ${escapeHtml(tripTitle)}
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${fieldHtml("Passenger", passengerName, "38%")}
                  ${fieldHtml("Destination", destination.toUpperCase(), undefined, 2)}
                </tr>
                <tr>
                  ${fieldHtml("Duration", `${days} day${days === 1 ? "" : "s"}`, "38%")}
                  ${fieldHtml(
                    "Forecast",
                    conditions ? `${tempLine} · ${conditions}` : tempLine,
                    undefined,
                    2
                  )}
                </tr>
                <tr>${detailRow2}</tr>
              </table>
            </td></tr>

            <tr><td style="padding:0 22px">
              <div style="border-top:2px dashed ${BRAND.oat};font-size:0;line-height:0">&nbsp;</div>
            </td></tr>

            <tr><td style="padding:16px 22px 4px">
              <div style="font:600 9px/1.4 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${BRAND.stone};margin-bottom:10px">
                carry-on allowance
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                ${[
                  ["tops", tops.length],
                  ["bottoms", bottoms.length],
                  ["shoes", shoes.length],
                ]
                  // Percentage widths only, with the gaps as percentages too:
                  // mixing in fixed-px spacers pushes the row over 100% and
                  // gives the 600px pass a minimum width it can't shrink below.
                  .map(
                    ([label, n]) => `
                  <td width="32%" align="center" style="width:32%;padding:10px 4px;background:${BRAND.panel};border-radius:12px">
                    <div style="font:700 26px/1.1 ${SANS};color:${BRAND.brown}">${n}</div>
                    <div style="font:600 9px/1.4 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${BRAND.stone};margin-top:2px">${label}</div>
                  </td>`
                  )
                  .join(`<td width="2%" style="width:2%;font-size:0;line-height:0">&nbsp;</td>`)}
              </tr></table>
            </td></tr>

            ${
              plan.packing_tip
                ? `<tr><td style="padding:16px 22px 0">
                     <div style="font:italic 400 16px/1.5 ${SERIF};color:${BRAND.ink};opacity:.85">
                       “${escapeHtml(plan.packing_tip)}”
                     </div>
                   </td></tr>`
                : ""
            }

            <tr><td align="center" style="padding:20px 22px 18px">
              ${barcodeHtml(`${destination}${days}${flight}`)}
              <div style="font:500 10px/1.4 ${SANS};letter-spacing:.28em;color:${BRAND.stone};margin-top:7px">
                ${escapeHtml(flight.replace(/\s/g, ""))} · ${escapeHtml(cityCode)}
              </div>
            </td></tr>
          </table>
        </td></tr>

        <!-- capsule -->
        <tr><td style="padding:26px 4px 0">
          <div style="font:600 10px/1.4 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${BRAND.stone};margin-bottom:12px">
            what's in the bag
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${capsuleGroup("tops", tops)}
            ${capsuleGroup("bottoms", bottoms)}
            ${capsuleGroup("shoes", shoes)}
            ${extrasHtml}
          </table>
        </td></tr>

        ${
          outfits.length > 0
            ? `<tr><td style="padding:14px 4px 0">
                 <div style="font:600 10px/1.4 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${BRAND.stone};margin-bottom:12px">
                   itinerary · ${outfits.length} outfit${outfits.length === 1 ? "" : "s"} from one carry-on
                 </div>
                 ${itineraryHtml}
               </td></tr>`
            : ""
        }

        <tr><td style="padding:0 4px">${dontForgetHtml}</td></tr>

        <tr><td align="center" style="padding:26px 4px 0">
          <div style="font:400 11px/1.6 ${SANS};color:${BRAND.stone}">
            sent from <strong style="color:${BRAND.brown}">pckt</strong> · one carry-on, zero stress
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  return {
    to,
    subject: `✈ your boarding pass — ${tripTitle}`,
    text,
    html,
  };
}

/**
 * Mail a stored packing plan to `to`, as its owner.
 *
 * Returns `notFound` when the id doesn't belong to this user (or isn't a trip
 * plan) so the route can 404 without leaking whether the row exists at all.
 */
export async function emailPackingPlan(args: {
  userId: string;
  planId: string;
  to: string;
  passengerName: string;
}): Promise<EmailResult & { notFound?: boolean }> {
  const { userId, planId, to, passengerName } = args;

  const { rows } = await pool.query(
    `SELECT context, options FROM recommendations WHERE id = $1 AND user_id = $2`,
    [planId, userId]
  );
  if (rows.length === 0) return { ok: false, notFound: true, error: "plan not found" };

  const options = (rows[0].options ?? {}) as StoredPlan & { trip?: boolean };
  // Daily outfit recommendations live in this table too; only trip rows have a
  // boarding pass to print.
  if (!options.trip) return { ok: false, notFound: true, error: "plan not found" };

  const message = buildBoardingPassEmail({
    plan: options,
    context: (rows[0].context ?? {}) as StoredContext,
    passengerName,
    to,
  });

  const result = await sendEmail(message);
  if (result.ok) track(userId, "packing_plan_emailed", { planId });
  return result;
}
