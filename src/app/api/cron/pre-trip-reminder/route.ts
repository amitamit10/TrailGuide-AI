export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  if (
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date();
  const in3Days = new Date(today.getTime() + 3 * 86400000)
    .toISOString()
    .split("T")[0];
  const tomorrow = new Date(today.getTime() + 86400000)
    .toISOString()
    .split("T")[0];

  // Find planning trips starting in 3 days or tomorrow, join profiles for full_name
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, user_id, profiles!inner(full_name)")
    .eq("status", "planning")
    .in("start_date", [in3Days, tomorrow]);

  if (error) {
    console.error("pre-trip-reminder: query error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const trip of trips ?? []) {
    // Fetch the user's email via the admin API (auth.users is not queryable via select)
    const { data: userData } = await supabase.auth.admin.getUserById(
      trip.user_id
    );
    const email = userData?.user?.email;
    if (!email) continue;

    const profile = trip.profiles as unknown as { full_name: string };
    const daysUntil = trip.start_date === tomorrow ? 1 : 3;
    const name = profile?.full_name?.split(" ")[0] || "Traveler";
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://trailguide-ai.vercel.app";

    const { error: sendError } = await resend.emails.send({
      from: "TrailGuide AI <onboarding@resend.dev>",
      to: email,
      subject: `${daysUntil === 1 ? "Tomorrow" : "3 days"} until ${trip.destination}! ✈️`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #2d6a4f;">Hi ${name}! Your trip is almost here 🌍</h2>
          <p>You're heading to <strong>${trip.destination}</strong> in <strong>${daysUntil} day${daysUntil !== 1 ? "s" : ""}</strong>.</p>
          <p><strong>Trip:</strong> ${trip.title}</p>
          <p><strong>Dates:</strong> ${trip.start_date} → ${trip.end_date}</p>
          <a href="${siteUrl}/trips/${trip.id}/timeline"
             style="display:inline-block; background:#2d6a4f; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; margin-top:16px;">
            View your itinerary →
          </a>
          <p style="margin-top:24px; color:#888; font-size:12px;">TrailGuide AI · You're receiving this because you have a trip planned.</p>
        </div>
      `,
    });

    if (sendError) {
      console.error("pre-trip-reminder: send error for", trip.id, sendError);
    } else {
      sent++;
    }
  }

  return NextResponse.json({ sent });
}
