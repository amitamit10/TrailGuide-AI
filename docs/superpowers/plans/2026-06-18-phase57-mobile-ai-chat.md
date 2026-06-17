# TrailGuide AI — Phase 57: Mobile AI Chat Companion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI chat companion for the mobile app — a chat interface accessible from any trip screen via a floating chat button. Supports streaming responses (SSE), displays messages in a scrollable bubble UI, and uses the same `POST /api/v1/ai/chat` endpoint as the web app.

**Architecture:** A persistent chat overlay mounted at the trip level. The Go backend proxies `/api/v1/ai/chat` to the Python service which uses Groq streaming (already built in Phase 17). Streaming is read via `ReadableStream` on React Native (RN 0.73+ supports Fetch streaming). Messages are stored in component state (not persisted — session only).

**Tech Stack:** React Native Fetch API (streaming), Expo, NativeWind, `@expo/vector-icons`.

**Prerequisite:** Phase 55 (mobile timeline). Phase 17 (Python AI service with streaming chat).

## Global Constraints
- Chat button is a fixed FAB at bottom-right: 💬 icon, brand green, appears on all trip screens.
- Chat opens as a sliding bottom sheet (not a new screen).
- Stream tokens appended to the last message as they arrive.
- Max visible messages: 50 (older messages removed from state, not from server).
- System context: trip destination + current day activities are included in every API call.
- No history persistence — new chat on every app launch.

---

## Task 1: Streaming chat hook

- [ ] **Step 1: Create `mobile/hooks/useAIChat.ts`**

```typescript
import { useState, useRef } from "react";
import { useSupabase } from "@/lib/supabase";

export interface Message { id: string; role: "user" | "assistant"; content: string; }

const BASE = process.env.EXPO_PUBLIC_API_URL!;

export function useAIChat(tripId: string, destination: string) {
  const { session } = useSupabase();
  const [messages, setMessages] = useState<Message[]>([{
    id: "0",
    role: "assistant",
    content: `Hi! I'm your AI travel companion for your trip to ${destination}. Ask me anything — local tips, restaurant recommendations, what to pack, how to get around…`,
  }]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function send(text: string) {
    if (!text.trim() || !session?.access_token) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };

    setMessages(prev => [...prev.slice(-48), userMsg, assistantMsg]);
    setLoading(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${BASE}/api/v1/ai/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          trip_id: tripId,
          message: text,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream unavailable");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const json = JSON.parse(data);
              const token = json.choices?.[0]?.delta?.content ?? "";
              if (token) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: m.content + token } : m
                ));
              }
            } catch {}
          }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: "Sorry, I had trouble connecting. Please try again." }
            : m
        ));
      }
    } finally {
      setLoading(false);
    }
  }

  function abort() { abortRef.current?.abort(); setLoading(false); }

  return { messages, send, loading, abort };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/hooks/useAIChat.ts
git commit -m "feat: add streaming AI chat hook using RN Fetch ReadableStream"
```

---

## Task 2: Chat UI component

- [ ] **Step 1: Create `mobile/components/AIChat.tsx`**

```tsx
import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Animated, Dimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAIChat, type Message } from "@/hooks/useAIChat";

interface Props {
  tripId: string;
  destination: string;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <View className={`flex-row mb-3 px-4 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <View className="w-7 h-7 rounded-full bg-brand items-center justify-center mr-2 mt-1">
          <Text className="text-white text-xs">AI</Text>
        </View>
      )}
      <View className={`max-w-[78%] px-4 py-3 rounded-2xl ${
        isUser ? "bg-brand rounded-tr-sm" : "bg-white rounded-tl-sm shadow-sm"
      }`}>
        <Text className={`text-sm leading-5 ${isUser ? "text-white" : "text-on-surface"}`}>
          {msg.content || "…"}
        </Text>
      </View>
    </View>
  );
}

export function AIChat({ tripId, destination }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, send, loading } = useAIChat(tripId, destination);
  const listRef = useRef<FlatList<Message>>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await send(text);
    listRef.current?.scrollToEnd({ animated: true });
  }

  const screenHeight = Dimensions.get("window").height;

  return (
    <>
      {/* Chat overlay */}
      {open && (
        <View
          className="absolute inset-0 z-40"
          style={{ top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <TouchableOpacity className="flex-1" onPress={() => setOpen(false)}/>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ height: screenHeight * 0.75 }}
            className="bg-surface rounded-t-3xl overflow-hidden"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <View>
                <Text className="font-bold text-on-surface">AI Travel Companion</Text>
                <Text className="text-xs text-gray-400">{destination}</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)}
                accessibilityRole="button" accessibilityLabel="Close chat">
                <Ionicons name="chevron-down" size={24} color="#9CA3AF"/>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              renderItem={({ item }) => <MessageBubble msg={item}/>}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            />

            {/* Input */}
            <View className="flex-row items-end gap-2 px-4 py-3 border-t border-gray-100 bg-white">
              <TextInput
                className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-on-surface text-sm max-h-24"
                placeholder={`Ask about ${destination}…`}
                value={input}
                onChangeText={setInput}
                multiline
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                accessibilityLabel="Message input"
              />
              <TouchableOpacity
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  loading || !input.trim() ? "bg-gray-200" : "bg-brand"
                }`}
                onPress={handleSend}
                disabled={loading || !input.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Ionicons name="send" size={16} color={loading || !input.trim() ? "#9CA3AF" : "white"}/>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-24 right-5 bg-brand w-14 h-14 rounded-full shadow-xl items-center justify-center z-30"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open AI chat"
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="white"/>
      </TouchableOpacity>
    </>
  );
}
```

- [ ] **Step 2: Add `<AIChat>` to the timeline screen**

In `mobile/app/(tabs)/trips/[id]/timeline.tsx`:
```tsx
import { AIChat } from "@/components/AIChat";

// Inside the SafeAreaView (at root level, not inside DraggableFlatList):
<AIChat tripId={id} destination={trip?.destination ?? ""}/>
```

- [ ] **Step 3: Commit**

```bash
git add mobile/components/AIChat.tsx mobile/app/\(tabs\)/trips/\[id\]/timeline.tsx
git commit -m "feat: add AI chat companion FAB with streaming SSE response bubbles"
```

---

## Verification Checklist

- [ ] 💬 FAB visible on timeline screen at bottom-right
- [ ] Tapping FAB opens chat panel sliding up from bottom
- [ ] First message is AI's greeting mentioning the destination
- [ ] Typing a message and pressing Send → message appears immediately
- [ ] AI response streams token by token (not all at once)
- [ ] Keyboard slides chat panel up (KeyboardAvoidingView works)
- [ ] Tap backdrop → closes chat panel
- [ ] "↓" close button also closes panel
- [ ] Empty input → Send button is greyed out and disabled
- [ ] Long AI responses scroll within the chat
