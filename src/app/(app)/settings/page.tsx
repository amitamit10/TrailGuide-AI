import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("telegram_chat_id, full_name")
    .eq("id", user.id)
    .single();

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";

  return (
    <SettingsClient
      userId={user.id}
      email={user.email ?? ""}
      fullName={profile?.full_name ?? ""}
      telegramLinked={!!profile?.telegram_chat_id}
      botUsername={botUsername}
    />
  );
}
