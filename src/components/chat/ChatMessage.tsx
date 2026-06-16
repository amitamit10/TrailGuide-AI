"use client";
import { Navigation, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div className={`flex gap-3 ${isAssistant ? "" : "flex-row-reverse"}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isAssistant ? "bg-primary" : "bg-muted"
        }`}
      >
        {isAssistant ? (
          <Navigation className="w-4 h-4 text-white" />
        ) : (
          <User className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isAssistant
            ? "bg-card text-foreground rounded-tl-sm"
            : "bg-primary text-white rounded-tr-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
