import Groq from "groq-sdk";
import type {
  TripConfig,
  GeneratedItinerary,
  CompanionNudgeOutput,
} from "@/types";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CHAT_MODEL = "llama-3.3-70b-versatile";
const FAST_MODEL = "llama-3.1-8b-instant";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const TRAVEL_AGENT_SYSTEM_PROMPT = `You are an expert AI travel planner called TrailGuide. Help users plan amazing trips through friendly conversation.

CRITICAL: You MUST collect ALL 5 required fields before setting complete:true. Ask ONE question at a time in this order:
1. Destination city/country
2. Travel dates — ask for BOTH start date AND end date (e.g. "When do you want to travel? What are your start and end dates?")
3. Number of travelers (exact number)
4. Travel style: "relaxed", "packed", or "balanced"
5. Interests (from: food & dining, history & culture, art & museums, nature & outdoors, nightlife, shopping, adventure sports, local experiences, hidden gems)

Also collect if available (optional):
- Departure city
- Ages of travelers
- Total budget and currency
- Whether flights are already booked
- Whether hotels are already booked

NEVER set "complete": true unless you have confirmed ALL of:
- destination (string)
- start_date (YYYY-MM-DD format)
- end_date (YYYY-MM-DD format)
- travelers_count (number)
- travel_style ("relaxed" | "packed" | "balanced")
- interests (array of strings)

If the user gives vague dates like "next month" or "in summer", ask them to confirm exact dates.

Once you have ALL required fields confirmed, respond ONLY with this exact JSON:
{
  "complete": true,
  "config": {
    "destination": "Paris, France",
    "destination_lat": 48.8566,
    "destination_lng": 2.3522,
    "departure_city": "New York",
    "start_date": "2026-08-01",
    "end_date": "2026-08-08",
    "travelers_count": 2,
    "traveler_ages": [32, 30],
    "budget_total": 5000,
    "budget_currency": "USD",
    "travel_style": "balanced",
    "interests": ["food & dining", "history & culture"],
    "flights_booked": true,
    "hotels_booked": false
  }
}

For all other messages respond with:
{ "complete": false, "message": "your conversational message here" }

Keep messages warm, brief, and exciting. Use 1-2 emojis occasionally. Never ask multiple questions at once.`;

const ITINERARY_SYSTEM_PROMPT = `You are an expert travel itinerary planner. Generate complete, realistic, day-by-day itineraries.

Return ONLY valid JSON, no markdown, no explanation. Match this exact structure:
{
  "days": [
    {
      "day_number": 1,
      "date": "2026-08-01",
      "activities": [
        {
          "title": "Activity name",
          "description": "2-3 sentence description of why it is worth visiting.",
          "category": "attraction",
          "start_time": "09:00",
          "end_time": "11:00",
          "duration_minutes": 120,
          "location_name": "Place name",
          "address": "Full street address",
          "lat": 48.8566,
          "lng": 2.3522,
          "estimated_cost": 15,
          "photo_query": "descriptive search query for a photo of this place"
        }
      ]
    }
  ]
}

Rules:
- category must be: food, attraction, transport, hotel, flight, or free
- Include transport activities (walking, metro, taxi) between locations
- Start each day with breakfast, end with dinner
- relaxed = 3-4 activities/day, balanced = 5-6, packed = 7-8
- Use accurate real-world coordinates
- estimated_cost is per person in the trip's currency (0 for free activities)
- photo_query should find a recognizable image of the specific place
- Mix famous attractions with local hidden gems based on stated interests`;

async function searchWeb(query: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query, max_results: 5, search_depth: "basic" }),
    });
    const data = await res.json();
    return (
      data.results
        ?.map(
          (r: { title: string; content: string }) =>
            `${r.title}: ${r.content.slice(0, 400)}`
        )
        .join("\n\n") ?? ""
    );
  } catch {
    return "";
  }
}

export class GeminiService {
  async sendChatMessage(
    history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>,
    message: string
  ): Promise<
    | { complete: false; message: string }
    | { complete: true; config: TripConfig }
  > {
    const today = new Date().toISOString().split("T")[0];
    const systemWithDate = `${TRAVEL_AGENT_SYSTEM_PROMPT}\n\nToday's date is ${today}. All travel dates must be in the future. Use this to interpret relative dates like "next week" or "in July".`;

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      ...history.map((h) => ({
        role: (h.role === "model" ? "assistant" : "user") as "user" | "assistant",
        content: h.parts.map((p) => p.text).join(""),
      })),
      { role: "user" as const, content: message },
    ];

    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemWithDate },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const text = completion.choices[0].message.content?.trim() ?? "";
    const jsonText = text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    try {
      return JSON.parse(jsonText);
    } catch {
      return { complete: false, message: text };
    }
  }

  async generateItinerary(config: TripConfig): Promise<GeneratedItinerary> {
    const webContext = await searchWeb(
      `${config.destination} travel guide top attractions restaurants tips ${new Date().getFullYear()}`
    );

    const transportLabel: Record<string, string> = {
      walking: "walking only — keep activities within walking distance of each other",
      transit: "public transit (bus, metro, subway)",
      car: "car or taxi",
      bicycle: "bicycle",
      mix: "mixed transport — choose the best mode for each leg",
    };

    const prompt = `Generate a complete day-by-day itinerary for this trip:

Destination: ${config.destination}
Dates: ${config.start_date} to ${config.end_date}
Travelers: ${config.travelers_count} people${config.traveler_ages?.length ? ` (ages: ${config.traveler_ages.join(", ")})` : ""}
${config.budget_total ? `Budget: ${config.budget_total} ${config.budget_currency} total` : "Flexible budget"}
Travel style: ${config.travel_style}
Interests: ${config.interests.join(", ")}
${config.transport_mode ? `Primary transport: ${transportLabel[config.transport_mode] ?? config.transport_mode}` : ""}
${(config.transport_mode === "walking" || config.transport_mode === "mix") && config.max_walk_minutes ? `Max walking time between activities: ${config.max_walk_minutes} minutes — do not schedule activities that require walking more than this apart` : ""}
${config.break_minutes !== undefined ? `Break time between activities: ${config.break_minutes === 0 ? "none — schedule activities back-to-back" : `${config.break_minutes} minutes of buffer between each activity`}` : ""}
${config.flights_booked ? "Flights already booked." : ""}
${config.hotels_booked ? "Hotels already booked." : ""}
${webContext ? `\nCurrent web info about ${config.destination}:\n${webContext}` : ""}

IMPORTANT scheduling rules:
- Include transport activities between locations that reflect the chosen transport mode
- Respect the break time preference — add gap between activity end_time and next start_time
- If transport is walking, cluster activities in the same neighbourhood per day
- Make start_time and end_time realistic given travel + break time

Return only valid JSON matching the required structure.`;

    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: ITINERARY_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0].message.content?.trim() ?? "{}";
    return JSON.parse(text) as GeneratedItinerary;
  }

  async editItinerary(
    currentItinerary: GeneratedItinerary,
    editCommand: string
  ): Promise<GeneratedItinerary> {
    const prompt = `Apply this modification to the travel itinerary and return the complete updated itinerary.

Current itinerary:
${JSON.stringify(currentItinerary, null, 2)}

Modification: "${editCommand}"

Return the complete updated itinerary JSON. Keep all unaffected activities unchanged.`;

    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: ITINERARY_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0].message.content?.trim() ?? "{}";
    return JSON.parse(text) as GeneratedItinerary;
  }

  async analyzeText(text: string, prompt: string): Promise<string> {
    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "You are a document data extractor. Return only valid JSON." },
        { role: "user", content: `${prompt}\n\nDocument text:\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });
    return completion.choices[0].message.content?.trim() ?? "{}";
  }

  async analyzeImage(base64: string, mimeType: string, prompt: string): Promise<string> {
    const completion = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });
    return completion.choices[0].message.content?.trim() ?? "";
  }

  async getCompanionNudges(params: {
    currentTime: string;
    currentLat: number;
    currentLng: number;
    nextActivity: { title: string; location: string; start_time: string };
    weatherSummary: string;
    destination: string;
  }): Promise<CompanionNudgeOutput[]> {
    const prompt = `You are a live travel companion. Generate 0-3 helpful nudges based on the traveler's current situation.

Current time: ${params.currentTime}
Current location: ${params.currentLat}, ${params.currentLng}
Next activity: "${params.nextActivity.title}" at ${params.nextActivity.location}, starting at ${params.nextActivity.start_time}
Weather: ${params.weatherSummary}
Destination: ${params.destination}

Return a JSON object with a "nudges" array:
{"nudges": [{"type": "timing", "message": "Short helpful message (max 100 chars)", "action_label": "optional button label", "action_data": {}}]}

type must be one of: timing, discovery, weather, navigation
Only include nudges that are genuinely useful right now. Return {"nudges": []} if none needed.`;

    const completion = await groq.chat.completions.create({
      model: FAST_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 512,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0].message.content?.trim() ?? '{"nudges":[]}';
    const parsed = JSON.parse(text);
    return parsed.nudges ?? [];
  }

  async generateTripStory(params: {
    destination: string;
    days: number;
    completedActivities: string[];
  }): Promise<string> {
    const prompt = `Write a warm, evocative travel story (3 short paragraphs) about a ${params.days}-day trip to ${params.destination}.

Activities completed: ${params.completedActivities.slice(0, 12).join(", ")}.

Write in second person ("You began your adventure..."). Make it feel like a cherished memory. Plain text only, no markdown.`;

    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 512,
    });

    return completion.choices[0].message.content?.trim() ?? "";
  }
}

export const gemini = new GeminiService();
