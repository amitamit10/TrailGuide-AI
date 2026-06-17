# TrailGuide AI — Phase 42: Voice Input

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add voice input to two key flows: (1) a mic button on the AI chat companion so users can speak instead of type, and (2) a voice "Quick Add" for activities — press and hold mic, say "dinner at Nobu at 7pm", and it gets parsed into a new activity card.

**Architecture:** Both flows use the Web Speech API (`SpeechRecognition`) — browser-native, free, no server calls. For Quick Add, the transcript goes to a new Python route `POST /ai/parse-activity` that extracts `title`, `time`, `category`, and `notes` from the natural language string and returns a structured activity object. The chat companion already accepts text input — voice just fills the same textarea.

**Tech Stack:** Web Speech API (built into Chrome/Safari/Firefox), Python (`POST /ai/parse-activity`), Next.js.

**Prerequisite:** Phase 17 (Python AI service). Phase 18 (Next.js frontend with chat).

## Global Constraints
- Web Speech API only works in HTTPS or localhost — note this in the UI for non-localhost dev.
- Graceful degradation: if `window.SpeechRecognition` is undefined (Firefox older, or server-side render), the mic button is hidden entirely.
- Voice activity parsing is optional — if the AI can't parse a field, leave it blank and let the user fill it in manually.
- "Quick Add" is a floating mic button on the timeline page.
- Language: use `recognition.lang = "en-US"` by default, with the trip's detected language as fallback.

---

## Task 1: Python — activity parser route

- [ ] **Step 1: Create `ai-service/routers/voice.py`**

```python
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class ParseActivityRequest(BaseModel):
    transcript: str
    destination: Optional[str] = None

@router.post("/parse-activity")
async def parse_activity(req: ParseActivityRequest):
    groq = get_groq()
    prompt = f"""Parse this voice transcript into a travel activity:

Transcript: "{req.transcript}"
{f'Destination context: {req.destination}' if req.destination else ''}

Extract what you can. Return ONLY valid JSON:
{{
  "title": "restaurant or activity name",
  "time": "HH:MM or null",
  "duration": "X hours/minutes or null",
  "category": "food|attraction|transport|hotel|free",
  "address": "address if mentioned or null",
  "cost": number or null,
  "notes": "anything else mentioned"
}}

If a field can't be determined, use null. Title must always be filled."""

    completion = await groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.1,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
    return json.loads(raw.strip())
```

- [ ] **Step 2: Register in `main.py`**

```python
from routers import voice
app.include_router(voice.router)
```

- [ ] **Step 3: Test**

```bash
curl -s -X POST http://localhost:8081/ai/parse-activity \
  -H "X-Internal-Token: $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"transcript":"dinner at Nobu at 7pm tomorrow, it is a sushi place near the river","destination":"London"}' \
  | python3 -m json.tool
# Expected: { "title": "Dinner at Nobu", "time": "19:00", "category": "food", ... }
```

- [ ] **Step 4: Commit**

```bash
git add ai-service/routers/voice.py ai-service/main.py
git commit -m "feat: add voice activity parser route (Groq llama-3.1-8b)"
```

---

## Task 2: React hook for speech recognition

- [ ] **Step 1: Create `src/hooks/useSpeechRecognition.ts`**

```typescript
"use client";
import { useState, useRef, useCallback } from "react";

interface UseSpeechOptions {
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  lang?: string;
}

export function useSpeechRecognition({ onResult, onError, continuous = false, lang = "en-US" }: UseSpeechOptions) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!isSupported || listening) return;
    const SpeechRecognition = window.SpeechRecognition ?? (window as typeof window & { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join(" ");
      onResult(transcript);
    };
    recognition.onerror = (event) => {
      onError?.(event.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [isSupported, listening, lang, continuous, onResult, onError]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { start, stop, listening, isSupported };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSpeechRecognition.ts
git commit -m "feat: add useSpeechRecognition hook wrapping Web Speech API"
```

---

## Task 3: Voice mic button on chat companion

- [ ] **Step 1: Update the AI chat textarea component**

Find the chat input area (in `src/components/companion/` or similar). Add a mic button beside the send button:

```typescript
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

// Inside the chat component:
const { start, stop, listening, isSupported } = useSpeechRecognition({
  onResult: (transcript) => {
    setInputValue(prev => prev ? `${prev} ${transcript}` : transcript);
  },
  lang: "en-US",
});

// In the UI, next to the send button:
{isSupported && (
  <button
    onMouseDown={start}
    onMouseUp={stop}
    onTouchStart={start}
    onTouchEnd={stop}
    className={`p-2 rounded-full transition-colors ${
      listening ? "bg-red-100 text-red-500" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
    }`}
    title="Hold to speak"
  >
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7V3m0 0a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z"/>
    </svg>
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/companion/
git commit -m "feat: add voice mic button to AI chat companion"
```

---

## Task 4: Voice Quick Add on timeline

- [ ] **Step 1: Create `src/components/timeline/VoiceQuickAdd.tsx`**

```typescript
"use client";
import { useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { api, aiApi } from "@/lib/api";

interface Props {
  tripId: string;
  dayId: string;
  destination: string;
  onAdded: () => void;
}

interface ParsedActivity {
  title: string; time: string | null; duration: string | null;
  category: string; address: string | null; cost: number | null; notes: string;
}

export function VoiceQuickAdd({ tripId, dayId, destination, onAdded }: Props) {
  const [parsed, setParsed] = useState<ParsedActivity | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { start, stop, listening, isSupported } = useSpeechRecognition({
    onResult: async (transcript) => {
      setProcessing(true);
      try {
        const result = await aiApi.post<ParsedActivity>("/parse-activity", {
          transcript, destination,
        });
        setParsed(result);
      } finally {
        setProcessing(false);
      }
    },
  });

  async function save() {
    if (!parsed) return;
    setSaving(true);
    await api.post(`/api/v1/days/${dayId}/activities`, {
      trip_id: tripId, day_id: dayId,
      title: parsed.title, time: parsed.time ?? "",
      duration: parsed.duration ?? "1 hour",
      category: parsed.category ?? "free",
      address: parsed.address ?? "",
      cost: parsed.cost ?? 0,
      description: parsed.notes ?? "",
      photo_query: parsed.title,
      sort_order: 999,
    });
    setParsed(null);
    setSaving(false);
    onAdded();
  }

  if (!isSupported) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50">
      {/* Parsed activity preview */}
      {parsed && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 mb-3 w-72">
          <p className="text-xs text-[#2D6A4F] font-medium mb-1">Heard:</p>
          <p className="text-sm font-bold text-gray-900">{parsed.title}</p>
          {parsed.time && <p className="text-xs text-gray-500 mt-0.5">⏰ {parsed.time}</p>}
          {parsed.address && <p className="text-xs text-gray-500">📍 {parsed.address}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => setParsed(null)} className="flex-1 text-xs text-gray-400 py-2">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 bg-[#2D6A4F] text-white text-xs py-2 rounded-xl">
              {saving ? "Adding…" : "Add to trip"}
            </button>
          </div>
        </div>
      )}

      {/* Mic button */}
      <button
        onMouseDown={start}
        onMouseUp={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
          listening ? "bg-red-500 scale-110" : processing ? "bg-gray-300" : "bg-[#2D6A4F]"
        }`}
        title="Hold to add activity by voice"
      >
        {processing ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7V3m0 0a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z"/>
          </svg>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add `VoiceQuickAdd` to the timeline page**

```tsx
// In timeline page, inside the authenticated view:
<VoiceQuickAdd
  tripId={tripId}
  dayId={selectedDayId}
  destination={trip.destination}
  onAdded={refetchActivities}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/VoiceQuickAdd.tsx src/app/\(app\)/trips/\[id\]/timeline/
git commit -m "feat: add voice Quick Add floating button on timeline page"
```

---

## Verification Checklist

- [ ] `POST /ai/parse-activity` returns structured activity from natural language
- [ ] `useSpeechRecognition` hook: `listening` turns true on start, false on end/error
- [ ] In Chrome: hold mic button on chat → voice fills textarea
- [ ] In Firefox (no SpeechRecognition): mic button is hidden entirely
- [ ] Voice Quick Add: hold mic → release → preview card appears → "Add to trip" creates activity
- [ ] Activity created by voice appears on timeline without page refresh
- [ ] HTTPS required note shown in dev (non-localhost) environments
