"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { QuickReplyChips } from "@/components/chat/QuickReplyChips";
import type { TripConfig } from "@/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type GeminiHistoryItem = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

const QUICK_REPLIES_BY_TURN: Record<number, string[]> = {
  0: [],
  1: ["Paris, France", "Tokyo, Japan", "New York, USA", "Rome, Italy"],
  2: [],
  3: ["Just me", "2 people", "Family of 4"],
  4: ["All adults", "Mostly adults"],
  5: ["Under $1,000", "$1,000–$3,000", "$5,000+", "Flexible"],
  6: ["Relaxed", "Balanced", "Packed"],
  7: [
    "Food & dining",
    "History & culture",
    "Nature & outdoors",
    "Art & museums",
  ],
};

const INITIAL_MESSAGE =
  "Hi! I'm TrailGuide, your AI travel planner. ✈️ Where would you like to go?";

export default function NewTripPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const [geminiHistory, setGeminiHistory] = useState<GeminiHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const newHistory: GeminiHistoryItem[] = [
      ...geminiHistory,
      { role: "user", parts: [{ text }] },
    ];

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: geminiHistory, message: text }),
      });

      if (!res.ok) throw new Error("Chat failed");

      const data = await res.json();

      if (data.complete === true && data.config) {
        const config = data.config as TripConfig;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Perfect! I have everything I need. Let me generate your personalized itinerary now... 🗺️",
          },
        ]);
        setGenerating(true);
        await generateItinerary(config);
      } else {
        const assistantText = data.message ?? "Let me think about that...";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantText },
        ]);
        setGeminiHistory([
          ...newHistory,
          { role: "model", parts: [{ text: assistantText }] },
        ]);
        setTurnIndex((t) => t + 1);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function generateItinerary(config: TripConfig) {
    try {
      const res = await fetch("/api/ai/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Generation failed");

      const itinerary = await res.json();

      sessionStorage.setItem(
        "pending_trip",
        JSON.stringify({ config, itinerary })
      );
      router.push("/trips/review");
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't generate your itinerary. Please try again.",
        },
      ]);
      setGenerating(false);
    }
  }

  const chips = QUICK_REPLIES_BY_TURN[turnIndex] ?? [];
  const isDisabled = loading || generating;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-white sticky top-0 z-10">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-semibold text-base">Plan a New Trip</h1>
          <p className="text-xs text-muted-foreground">Chat with TrailGuide AI</p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4"
      >
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3">
              <span className="text-muted-foreground text-sm">Thinking...</span>
            </div>
          </div>
        )}
        {generating && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Crafting your perfect itinerary...</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-background border-t border-border">
        <QuickReplyChips chips={chips} onSelect={sendMessage} />
        <ChatInput onSend={sendMessage} disabled={isDisabled} />
      </div>
    </div>
  );
}
