import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  TripConfig,
  GeneratedItinerary,
  CompanionNudgeOutput,
} from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const TRAVEL_AGENT_SYSTEM_PROMPT = `You are an expert AI travel planner called TrailGuide. Help users plan amazing trips through friendly conversation.

Ask ONE question at a time. Collect this information in order:
1. Destination city/country
2. Departure city
3. Travel dates (start and end)
4. Number of travelers
5. Ages of travelers (for family-appropriate recommendations)
6. Total budget and currency
7. Travel style: "relaxed" (slow pace), "packed" (see everything), or "balanced"
8. Interests (food & dining, history & culture, art & museums, nature & outdoors, nightlife, shopping, adventure sports, local experiences, hidden gems)
9. Whether flights are already booked
10. Whether hotels are already booked

Required: destination, start_date, end_date, travelers_count, travel_style, interests.
Optional: departure_city, traveler_ages, budget_total, flights_booked, hotels_booked.

Once you have all required fields, respond ONLY with this exact JSON:
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

export class GeminiService {
  private model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  async sendChatMessage(
    history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>,
    message: string
  ): Promise<
    | { complete: false; message: string }
    | { complete: true; config: TripConfig }
  > {
    const chat = this.model.startChat({
      history,
      systemInstruction: TRAVEL_AGENT_SYSTEM_PROMPT,
    });

    const result = await chat.sendMessage(message);
    const text = result.response.text().trim();

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
    const prompt = `Generate a complete day-by-day itinerary for this trip:

Destination: ${config.destination}
Dates: ${config.start_date} to ${config.end_date}
Travelers: ${config.travelers_count} people${config.traveler_ages?.length ? ` (ages: ${config.traveler_ages.join(", ")})` : ""}
${config.budget_total ? `Budget: ${config.budget_total} ${config.budget_currency} total` : "Flexible budget"}
Travel style: ${config.travel_style}
Interests: ${config.interests.join(", ")}
${config.flights_booked ? "Flights already booked." : ""}
${config.hotels_booked ? "Hotels already booked." : ""}

Return only valid JSON.`;

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: ITINERARY_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const text = result.response.text().trim();
    const jsonText = text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    return JSON.parse(jsonText) as GeneratedItinerary;
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

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: ITINERARY_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const text = result.response.text().trim();
    const jsonText = text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    return JSON.parse(jsonText) as GeneratedItinerary;
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

Return a JSON array (empty [] if no nudges needed):
[{
  "type": "timing",
  "message": "Short helpful message (max 100 chars)",
  "action_label": "optional button label",
  "action_data": {}
}]

type must be one of: timing, discovery, weather, navigation
Only include nudges that are genuinely useful right now.`;

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });

    const text = result.response.text().trim();
    const jsonText = text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    return JSON.parse(jsonText) as CompanionNudgeOutput[];
  }

  async generateTripStory(params: {
    destination: string;
    days: number;
    completedActivities: string[];
  }): Promise<string> {
    const prompt = `Write a warm, evocative travel story (3 short paragraphs) about a ${params.days}-day trip to ${params.destination}.

Activities completed: ${params.completedActivities.slice(0, 12).join(", ")}.

Write in second person ("You began your adventure..."). Make it feel like a cherished memory. Plain text only, no markdown.`;

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}

export const gemini = new GeminiService();
