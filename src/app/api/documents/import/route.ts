import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const EXTRACTION_PROMPT = `Extract all travel booking information from this document. Return ONLY valid JSON with this structure:
{
  "type": "flight | hotel | airbnb | other",
  "flight_number": "AA123",
  "airline": "American Airlines",
  "departure_airport": "JFK",
  "arrival_airport": "CDG",
  "departure_time": "2026-08-01T08:30:00",
  "arrival_time": "2026-08-01T22:15:00",
  "hotel_name": "Hotel Name",
  "hotel_address": "Full address",
  "check_in": "2026-08-01",
  "check_out": "2026-08-08",
  "confirmation_number": "ABC123",
  "passenger_names": ["Name 1"],
  "room_type": "Deluxe Double",
  "notes": "any other useful info"
}
Omit fields that are not present in the document. Be accurate - extract only what is actually there.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const tripId = formData.get("tripId") as string | null;

  if (!file || !tripId) {
    return NextResponse.json({ error: "file and tripId required" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const mimeType = file.type;

  try {
    let extractedJson: Record<string, unknown>;

    if (mimeType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result.text;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const geminiResult = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACTION_PROMPT },
              { text: `\n\nDocument text:\n${text.slice(0, 8000)}` },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      });

      const raw = geminiResult.response.text().trim();
      extractedJson = JSON.parse(
        raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
      );
    } else if (
      mimeType.startsWith("image/")
    ) {
      const base64 = buffer.toString("base64");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACTION_PROMPT },
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      });

      const raw = result.response.text().trim();
      extractedJson = JSON.parse(
        raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
      );
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload PDF or image." },
        { status: 400 }
      );
    }

    const { data: doc } = await supabase
      .from("documents")
      .insert({
        trip_id: tripId,
        type: extractedJson.type ?? "other",
        extracted_json: extractedJson,
      })
      .select()
      .single();

    return NextResponse.json({ success: true, doc, extracted: extractedJson });
  } catch (err) {
    console.error("Document import error:", err);
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 });
  }
}
