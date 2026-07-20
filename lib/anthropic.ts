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
