import { timingSafeEqual as cryptoTimingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Bot, webhookCallback } from "grammy";
import { createServiceClient } from "@/lib/supabase/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export function makeBot() {
  if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const bot = new Bot(TOKEN);

  // /start — shows the user their Telegram Chat ID to paste into the app
  bot.command("start", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    await ctx.reply(
      `👋 Welcome to *TrailGuide AI*\\!\n\nYour Telegram ID is:\n\`${chatId}\`\n\nCopy it, then open the app → *Settings → Connect Telegram* and paste it there\\.\n\nOnce linked you can use:\n/trip — today's itinerary\n/next — next activity\n/status — trip countdown`,
      { parse_mode: "MarkdownV2" }
    );
  });

  // /trip — today's schedule
  bot.command("trip", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const supabase = createServiceClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_chat_id", chatId)
      .single();

    if (!profile) {
      await ctx.reply("Please link your account first — open TrailGuide → Settings.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: trip } = await supabase
      .from("trips")
      .select("id, title, destination")
      .eq("user_id", profile.id)
      .eq("status", "active")
      .single();

    if (!trip) {
      const { data: nextTrip } = await supabase
        .from("trips")
        .select("title, start_date")
        .eq("user_id", profile.id)
        .eq("status", "planning")
        .order("start_date", { ascending: true })
        .limit(1)
        .single();
      if (nextTrip) {
        await ctx.reply(`📅 No active trip today.\n\nNext trip: *${nextTrip.title}* starting ${nextTrip.start_date}`, { parse_mode: "Markdown" });
      } else {
        await ctx.reply("No trips found. Plan one at the app 🗺️");
      }
      return;
    }

    const { data: day } = await supabase
      .from("itinerary_days")
      .select("id")
      .eq("trip_id", trip.id)
      .eq("date", today)
      .single();

    if (!day) {
      await ctx.reply(`📍 *${trip.title}*\n\nNo activities scheduled for today.`, { parse_mode: "Markdown" });
      return;
    }

    const { data: activities } = await supabase
      .from("activities")
      .select("title, start_time, location_name, is_completed")
      .eq("day_id", day.id)
      .order("sort_order", { ascending: true });

    if (!activities?.length) {
      await ctx.reply("No activities today.");
      return;
    }

    const lines = activities.map((a) =>
      `${a.is_completed ? "✅" : "⏰"} *${a.title}*${a.start_time ? ` — ${a.start_time}` : ""}${a.location_name ? `\n   📍 ${a.location_name}` : ""}`
    );
    await ctx.reply(`📅 *Today in ${trip.destination}*\n\n${lines.join("\n\n")}`, { parse_mode: "Markdown" });
  });

  // /next — next upcoming activity
  bot.command("next", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const supabase = createServiceClient();
    const { data: profile } = await supabase.from("profiles").select("id").eq("telegram_chat_id", chatId).single();
    if (!profile) { await ctx.reply("Please link your account first."); return; }

    const today = new Date().toISOString().split("T")[0];
    const { data: trip } = await supabase.from("trips").select("id, destination").eq("user_id", profile.id).eq("status", "active").single();
    if (!trip) { await ctx.reply("No active trip found."); return; }

    const { data: day } = await supabase.from("itinerary_days").select("id").eq("trip_id", trip.id).eq("date", today).single();
    if (!day) { await ctx.reply("No activities scheduled for today."); return; }

    const { data: next } = await supabase
      .from("activities")
      .select("title, start_time, location_name, description")
      .eq("day_id", day.id)
      .eq("is_completed", false)
      .order("sort_order", { ascending: true })
      .limit(1)
      .single();

    if (!next) { await ctx.reply("🎉 All done for today!"); return; }

    await ctx.reply(
      `⏭️ *Next up:* ${next.title}${next.start_time ? `\n🕐 ${next.start_time}` : ""}${next.location_name ? `\n📍 ${next.location_name}` : ""}${next.description ? `\n\n${next.description}` : ""}`,
      { parse_mode: "Markdown" }
    );
  });

  // /status — trip countdown
  bot.command("status", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const supabase = createServiceClient();
    const { data: profile } = await supabase.from("profiles").select("id").eq("telegram_chat_id", chatId).single();
    if (!profile) { await ctx.reply("Please link your account first."); return; }

    const { data: trips } = await supabase
      .from("trips")
      .select("title, destination, start_date, end_date, status")
      .eq("user_id", profile.id)
      .in("status", ["planning", "active"])
      .order("start_date", { ascending: true })
      .limit(3);

    if (!trips?.length) { await ctx.reply("No upcoming trips."); return; }

    const today = new Date();
    const lines = trips.map((t) => {
      const start = new Date(t.start_date);
      const end = new Date(t.end_date);
      const daysUntil = Math.ceil((start.getTime() - today.getTime()) / 86400000);
      const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000);
      const status = t.status === "active"
        ? `🟢 Active · ${daysLeft}d remaining`
        : daysUntil <= 0 ? "Today!" : `📅 In ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
      return `✈️ *${t.title}*\n📍 ${t.destination}\n${status}`;
    });

    await ctx.reply(lines.join("\n\n"), { parse_mode: "Markdown" });
  });

  return bot;
}

// Webhook handler (used in production)
export async function POST(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: "Bot not configured" }, { status: 503 });

  // Verify the request actually came from Telegram. Register the webhook with
  // ?secret_token=<TELEGRAM_WEBHOOK_SECRET> so Telegram sends this header on
  // every update; reject anything that doesn't match.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const bot = makeBot();
    const handler = webhookCallback(bot, "std/http");
    return handler(req);
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return cryptoTimingSafeEqual(bufA, bufB);
}
