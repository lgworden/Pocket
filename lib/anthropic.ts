import Anthropic from "@anthropic-ai/sdk";
import { formatLearnedProfileForClaude } from "./learnedProfileBuilder";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Claude occasionally wraps JSON in fences or a stray sentence despite instructions;
// pull out the outermost {...} block rather than assuming the whole string parses.
function parseJsonResponse(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return JSON.parse(cleaned);
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Used by the Add Item flow (Phase 1): snap a photo, get a draft item back.
export async function draftItemFromPhoto(base64Image: string, mediaType: string) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as any, data: base64Image } },
          {
            type: "text",
            text: `Look at this clothing item photo. Respond ONLY with JSON, no preamble:
{
  "name": string,
  "category": "top"|"bottom"|"dress"|"outerwear"|"shoes"|"bag"|"accessory",
  "subcategory": string,
  "colors": string[],
  "warmth": number (1-5),
  "formality": number (1-5),
  "occasions": string[]
}`,
          },
        ],
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text")?.text ?? "{}";
  return parseJsonResponse(text);
}

// Used by the "log my items" flow: one full outfit photo -> Claude identifies
// every distinct clothing/accessory piece worn, each with its own draft fields
// (same shape as draftItemFromPhoto) plus an approximate bounding box so the
// client can crop a per-item thumbnail out of the same photo.
export async function draftItemsFromOutfitPhoto(base64Image: string, mediaType: string) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as any, data: base64Image } },
          {
            type: "text",
            text: `Look at this photo of a full outfit (someone wearing it, or the pieces laid out together). Identify each distinct clothing item, pair of shoes, bag, or accessory visible — skip skin, hair, and background. Respond ONLY with JSON, no preamble:
{
  "items": [
    {
      "name": string,
      "category": "top"|"bottom"|"dress"|"outerwear"|"shoes"|"bag"|"accessory",
      "subcategory": string,
      "colors": string[],
      "warmth": number (1-5),
      "formality": number (1-5),
      "occasions": string[],
      "bounding_box": { "x": number, "y": number, "width": number, "height": number }
    }
  ]
}
bounding_box values are fractions of the full image (0 to 1, top-left origin) — your best approximate crop around that one piece, used only for a preview thumbnail, not anything precise. List at most 8 items, most prominent/central piece first.`,
          },
        ],
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text")?.text ?? "{}";
  return parseJsonResponse(text);
}

// Used by the Today screen recommendation engine (Phase 2).
// See closet-stylist-build-plan.md (or pocket-build-plan.md) → "The Recommendation Prompt" for the full prompt spec.
export async function getRecommendations(
  promptContext: Record<string, unknown>,
  userName: string = "friend"
) {
  // Extract and remove learned_profile from context before stringifying
  const learned_profile = (promptContext as any).learned_profile;
  const { learned_profile: _, ...contextForJson } = promptContext as any;

  // Build personalized system message if learned profile exists
  const personalizedMessage = learned_profile
    ? formatLearnedProfileForClaude(learned_profile, userName)
    : "";

  const systemPrefix = personalizedMessage ? `${personalizedMessage}\n\n` : "";

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: `${systemPrefix}You are a personal stylist. Recommend outfits from the user's actual closet — never suggest items they don't own, except as a single optional "gap" question at the end.

CONTEXT:
${JSON.stringify(contextForJson, null, 2)}

Rules:
- Propose 2-3 complete outfits (top/bottom or dress, shoes, outerwear if temp warrants, one optional accessory or bag).
- Reference items by display_id and name — only items that appear in CONTEXT.closet.
- One sentence of reasoning per outfit tying it to the weather and the day's activities.
- Avoid exact-outfit repeats from the last 14 days; favor under-worn items when appropriate.
- Respect formality: infer required formality from the day summary and any calendar events.
- CONTEXT.weather_event_history (if not null) is what the user actually wore in the past on days with similar weather and a similar kind of event on the calendar — treat it as a strong signal, not a suggestion to repeat verbatim. Favor its topItems/topColors/topCategories when they fit today's closet-filtered options, and let its avgFormality/avgWarmth calibrate your picks.
- CONTEXT.schedule_constraints (if non-empty) lists pairs of back-to-back calendar events with no time to go home and change between them. For each one, propose a single outfit formal/versatile enough to work across ALL the events it spans — do not propose an outfit that only suits one of them — and say so explicitly in that outfit's reasoning.
- Optionally end with ONE gap-fill question.

Respond ONLY with JSON, no preamble, in exactly this shape:
{
  "outfits": [
    {
      "title": string,
      "reasoning": string,
      "items": [{ "display_id": string, "name": string }]
    }
  ],
  "gap_question": string | null
}`,
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text")?.text ?? "{}";
  return parseJsonResponse(text);
}

// Used by the Pack My Bags flow: builds a 3-3-3 capsule (3 tops, 3 bottoms, 3
// pairs of shoes that all mix-and-match) scaled for the trip, then maps the
// pieces into outfits for each activity. See the 3-3-3 packing method.
export async function getPackingPlan(
  promptContext: Record<string, unknown>,
  userName: string = "friend"
) {
  const learned_profile = (promptContext as any).learned_profile;
  const { learned_profile: _, ...contextForJson } = promptContext as any;

  const personalizedMessage = learned_profile
    ? formatLearnedProfileForClaude(learned_profile, userName)
    : "";
  const systemPrefix = personalizedMessage ? `${personalizedMessage}\n\n` : "";

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `${systemPrefix}You are a personal stylist helping ${userName} pack a carry-on for a trip using the 3-3-3 packing method: pack 3 tops, 3 bottoms, and 3 pairs of shoes that ALL mix and match, so a tiny capsule multiplies into many outfits. Build the capsule ONLY from the user's actual closet.

CONTEXT:
${JSON.stringify(contextForJson, null, 2)}

Rules:
- Build a core capsule of ideally 3 tops, 3 bottoms, and 3 pairs of shoes from CONTEXT.closet, chosen so they mix-and-match freely (shared, cohesive color palette). For longer trips (CONTEXT.trip.days) you may scale up to 4-5 of a category; for very short trips 2 is fine. Prioritize versatile, under-worn, weather-appropriate pieces.
- Every activity in CONTEXT.trip.activities MUST be covered. Add category-appropriate EXTRAS beyond the core capsule only where an activity needs something the capsule can't do: e.g. a swimsuit for "beach_pool", activewear for "gym_activewear" or "hiking", a formal/dressy outfit for "wedding" or "formal_dinner", going-out pieces for "nightlife".
- Add outerwear and layers if CONTEXT.trip_weather warrants (cold lows, rain, wind). Dress for the coldest low, not the warmest high.
- Reference items ONLY by display_id and name, and ONLY items that appear in CONTEXT.closet.
- Produce a set of complete mix-and-match outfits (aim for one flexible outfit per day of the trip, up to ~7, each tied to an activity or a general day). Each outfit's items must all come from the packed capsule + extras you listed. Reuse capsule pieces across outfits — that is the whole point of 3-3-3.
- "dont_forget" is a short list of practical things the user likely needs but does NOT appear to own in CONTEXT.closet (e.g. "a swimsuit", "a rain jacket", "dressy heels"). Keep it to genuine gaps for the chosen activities/weather; empty array if none.
- Keep every string lowercase-friendly and warm; the packing_tip should be one upbeat, gen-z-friendly sentence.

Respond ONLY with JSON, no preamble, in exactly this shape:
{
  "trip_title": string,
  "packing_tip": string,
  "capsule": {
    "tops": [{ "display_id": string, "name": string }],
    "bottoms": [{ "display_id": string, "name": string }],
    "shoes": [{ "display_id": string, "name": string }],
    "extras": [{ "display_id": string, "name": string, "reason": string }]
  },
  "outfits": [
    {
      "title": string,
      "activity": string,
      "reasoning": string,
      "items": [{ "display_id": string, "name": string }]
    }
  ],
  "dont_forget": string[]
}`,
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text")?.text ?? "{}";
  return parseJsonResponse(text);
}

// Used by the weekly style analysis notification: turns this week's worn items
// plus the all-time learned/analyzed preference data into a short, personal recap.
export async function getWeeklyStyleSummary(
  weeklyWornItems: Array<{ display_id: string; name: string; date: string }>,
  allTimeAnalysis: Record<string, unknown> | null,
  userName: string = "friend"
): Promise<{ weekly_vibe: string; alltime_note: string }> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are ${userName}'s personal stylist writing a short weekly recap notification.

THIS WEEK'S LOGGED OUTFITS (item display_id, name, date worn):
${JSON.stringify(weeklyWornItems, null, 2)}

ALL-TIME PREFERENCE DATA (may be null if not enough history yet):
${JSON.stringify(allTimeAnalysis, null, 2)}

Write two short pieces of text:
- weekly_vibe: 1-2 sentences describing the vibe/pattern of what they wore this week. Warm, specific, second person ("you leaned into..."). If no outfits were logged this week, say so gently and encourage logging.
- alltime_note: 1 sentence surfacing one notable all-time pattern (a favorite color, most-trusted item, recurring formality range, etc). If allTimeAnalysis is null or too sparse, return an empty string.

Respond ONLY with JSON, no preamble, in exactly this shape:
{ "weekly_vibe": string, "alltime_note": string }`,
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text")?.text ?? "{}";
  return parseJsonResponse(text);
}
