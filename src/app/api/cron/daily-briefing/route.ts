export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

async function sendTelegram(chatId: string, text: string) {
  await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    }
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Find all active trips whose users have telegram_chat_id set
  const { data: trips } = await supabase
    .from("trips")
    .select(
      "id, title, destination, user_id, profiles!inner(telegram_chat_id)"
    )
    .eq("status", "active")
    .not("profiles.telegram_chat_id", "is", null);

  let sent = 0;
  for (const trip of trips ?? []) {
    const profile = trip.profiles as unknown as { telegram_chat_id: string };
    const chatId = profile.telegram_chat_id;

    const { data: day } = await supabase
      .from("itinerary_days")
      .select("id")
      .eq("trip_id", trip.id)
      .eq("date", today)
      .single();

    if (!day) continue;

    const { data: activities } = await supabase
      .from("activities")
      .select("title, start_time, location_name, is_completed")
      .eq("day_id", day.id)
      .order("sort_order", { ascending: true });

    if (!activities?.length) continue;

    const lines = activities.map((a) =>
      `${a.is_completed ? "✅" : "⏰"} *${a.title}*${
        a.start_time ? ` — ${a.start_time}` : ""
      }${a.location_name ? `\n   📍 ${a.location_name}` : ""}`
    );

    await sendTelegram(
      chatId,
      `☀️ *Good morning! Today in ${trip.destination}*\n\n${lines.join(
        "\n\n"
      )}\n\nHave a great day!`
    );
    sent++;
  }

  return NextResponse.json({ sent });
}
