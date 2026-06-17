// Run this to test the Telegram bot locally (no public URL needed)
// Usage: node scripts/telegram-poll.mjs
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error("TELEGRAM_BOT_TOKEN not set"); process.exit(1); }

// Simple long-poll loop using the Telegram HTTP API directly
let offset = 0;
console.log("🤖 TrailGuideAI_bot polling for messages... (Ctrl+C to stop)");
console.log("ℹ️  Note: /trip, /next, /status require linking via the app first.");
console.log("   To link: open app → Settings → Connect Telegram\n");

async function poll() {
  while (true) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${offset}&timeout=30`
      );
      const data = await res.json();
      for (const update of data.result ?? []) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg?.text) continue;
        console.log(`📨 @${msg.from?.username ?? msg.from?.first_name}: ${msg.text}`);

        // Forward to local Next.js webhook handler
        const fwd = await fetch("http://localhost:3000/api/telegram/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
        console.log(`   → forwarded to local handler: ${fwd.status}`);
      }
    } catch (e) {
      console.error("Poll error:", e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

poll();
