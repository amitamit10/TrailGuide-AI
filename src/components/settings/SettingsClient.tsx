"use client";
import { useState } from "react";
import { ArrowLeft, Check, Send, User, Mail, Loader2 } from "lucide-react";
import Link from "next/link";

interface Props {
  userId: string;
  email: string;
  fullName: string;
  telegramLinked: boolean;
  botUsername: string;
}

export function SettingsClient({ email, fullName, telegramLinked, botUsername }: Props) {
  const [linked, setLinked] = useState(telegramLinked);
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setLinked(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-white sticky top-0 z-10">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-semibold text-base">Settings</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Profile */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account</p>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium text-foreground">{fullName || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">{email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Telegram */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Telegram Notifications</p>
          </div>
          <div className="px-4 py-4 flex flex-col gap-4">
            {linked ? (
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl border border-primary/20">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-primary text-sm">Telegram connected</p>
                  <p className="text-xs text-muted-foreground mt-0.5">You&apos;ll receive trip reminders and AI nudges</p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-muted/60 rounded-xl p-4 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-foreground">How to connect:</p>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>Open <strong>@{botUsername || "TrailGuideAI_bot"}</strong> on Telegram and tap <strong>Start</strong></li>
                    <li>The bot will show your <strong>Telegram ID</strong> (a number)</li>
                    <li>Paste it below and tap <strong>Save</strong></li>
                  </ol>
                </div>

                {botUsername && (
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 rounded-xl bg-[#229ED9] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#1a8bbf] transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Open @{botUsername}
                  </a>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Paste your Telegram ID…"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value.trim())}
                    className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!chatId || saving}
                    className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </button>
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}
              </>
            )}
          </div>
        </div>

        {/* What you'll receive */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What you&apos;ll receive</p>
          </div>
          <div className="divide-y divide-border">
            {[
              { emoji: "⏰", label: "Daily itinerary", desc: "Morning summary of today's activities" },
              { emoji: "🤖", label: "AI nudges",        desc: "Real-time tips while you travel" },
              { emoji: "🌦️", label: "Weather alerts",   desc: "Rain or weather changes ahead" },
              { emoji: "✈️", label: "Trip reminders",   desc: "24h and day-of departure alerts" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg leading-none">{item.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
